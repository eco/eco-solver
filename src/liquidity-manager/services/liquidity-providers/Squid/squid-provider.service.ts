import { createApproveTransaction } from '@/liquidity-manager/utils/transaction'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { getSlippage } from '@/liquidity-manager/utils/math'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { parseUnits } from 'viem'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { Squid } from '@0xsquid/sdk'

@Injectable()
export class SquidProviderService implements OnModuleInit, IRebalanceProvider<'Squid'> {
  private logger = new LiquidityManagerLogger('SquidProviderService')
  private squid: Squid

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly rebalanceRepository: RebalanceRepository,
  ) {}

  async onModuleInit() {
    const squidConfig = this.ecoConfigService.getSquid()
    this.squid = new Squid({
      baseUrl: squidConfig.baseUrl,
      integratorId: squidConfig.integratorId,
    })
    await this.squid.init()
  }

  getStrategy() {
    return 'Squid' as const
  }

  @LogOperation('provider_quote_generation', LiquidityManagerLogger)
  async getQuote(
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
    @LogContext id?: string,
  ): Promise<RebalanceQuote<'Squid'>[]> {
    const walletAddress = await this.kernelAccountClientService.getAddress()
    const { swapSlippage } = this.ecoConfigService.getLiquidityManager()

    const params = {
      fromAddress: walletAddress,
      fromChain: tokenIn.chainId.toString(),
      fromToken: tokenIn.config.address,
      fromAmount: parseUnits(swapAmount.toString(), tokenIn.balance.decimals).toString(),
      toChain: tokenOut.chainId.toString(),
      toToken: tokenOut.config.address,
      toAddress: walletAddress,
      slippage: swapSlippage * 100, // Slippage is in basis points
      quoteOnly: false,
    }

    try {
      const { route } = await this.squid.getRoute(params)

      const slippage = getSlippage(route.estimate.toAmountMin, route.estimate.fromAmount)

      const quote: RebalanceQuote<'Squid'> = {
        amountIn: BigInt(route.estimate.fromAmount),
        amountOut: BigInt(route.estimate.toAmount),
        slippage,
        tokenIn,
        tokenOut,
        strategy: this.getStrategy(),
        context: route,
        id,
      }

      // Log provider quote generation success
      this.logger.logProviderQuoteGeneration(
        'Squid',
        {
          sourceChainId: tokenIn.chainId,
          destinationChainId: tokenOut.chainId,
          amount: swapAmount,
          tokenIn: tokenIn.config.address,
          tokenOut: tokenOut.config.address,
          slippage: swapSlippage,
        },
        true,
      )

      return [quote]
    } catch (error) {
      // Log provider quote generation failure
      this.logger.logProviderQuoteGeneration(
        'Squid',
        {
          sourceChainId: tokenIn.chainId,
          destinationChainId: tokenOut.chainId,
          amount: swapAmount,
          tokenIn: tokenIn.config.address,
          tokenOut: tokenOut.config.address,
          slippage: this.ecoConfigService.getLiquidityManager().swapSlippage,
        },
        false,
      )

      throw error
    }
  }

  @LogOperation('provider_execution', LiquidityManagerLogger)
  async execute(
    @LogContext walletAddress: string,
    @LogContext quote: RebalanceQuote<'Squid'>,
  ): Promise<string> {
    // Log provider execution start
    this.logger.logProviderExecution('Squid', walletAddress, quote)

    try {
      const kernelAddress = await this.kernelAccountClientService.getAddress()
      if (walletAddress !== kernelAddress) {
        throw EcoError.InvalidKernelAccountConfig()
      }

      const { context: route } = quote
      const approveTx = createApproveTransaction(
        route.params.fromToken,
        route.transactionRequest.target!,
        BigInt(route.params.fromAmount),
      )

      // Build the Squid router execution tx
      const swapTx = {
        to: route.transactionRequest.target,
        data: route.transactionRequest.data,
        value: route.transactionRequest.value ? BigInt(route.transactionRequest.value) : undefined,
      }

      const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

      // Execute all in a single userOp to beat the expiry.
      const txHash = await client.execute([approveTx, swapTx])

      const txReceipt = await client.waitForTransactionReceipt({
        hash: txHash,
      })

      if (!txReceipt) {
        throw new Error('Transaction receipt was null.')
      }

      await this.rebalanceRepository.updateStatus(quote.rebalanceJobID!, RebalanceStatus.COMPLETED)
      return txReceipt.transactionHash
    } catch (error) {
      await this.rebalanceRepository.updateStatus(quote.rebalanceJobID!, RebalanceStatus.FAILED)
      throw error
    }
  }
}
