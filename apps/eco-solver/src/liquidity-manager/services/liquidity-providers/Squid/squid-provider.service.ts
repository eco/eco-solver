import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Squid } from '@0xsquid/sdk'
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider'
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types'
import { EcoConfigService } from '@libs/eco-solver-config'
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service'
import { parseUnits } from 'viem'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { EcoError } from '@eco-solver/common/errors/eco-error'
import { getSlippage } from '@eco-solver/liquidity-manager/utils/math'
import { createApproveTransaction } from '@eco-solver/liquidity-manager/utils/transaction'

@Injectable()
export class SquidProviderService implements OnModuleInit, IRebalanceProvider<'Squid'> {
  private logger = new Logger(SquidProviderService.name)
  private squid: Squid

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
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

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'Squid'>[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Squid: getting quote',
        id,
        properties: { tokenIn, tokenOut, swapAmount },
      }),
    )

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

      this.logger.debug(
        EcoLogMessage.withId({
          message: 'Squid: quote generated',
          id,
          properties: { quote },
        }),
      )

      return [quote]
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          message: 'Squid: failed to get quote',
          id,
          error,
          properties: { params },
        }),
      )
      throw error
    }
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'Squid'>): Promise<string> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Squid: executing quote',
        id: quote.id,
        properties: { walletAddress, quote },
      }),
    )

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

      this.logger.log(
        EcoLogMessage.withId({
          message: 'Squid: execution complete',
          id: quote.id,
          properties: { receipt: txReceipt },
        }),
      )

      return txReceipt.transactionHash
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          message: `Squid: failed to execute quote`,
          id: quote.id,
          error,
          properties: { walletAddress, quote },
        }),
      )
      throw error
    }
  }
}
