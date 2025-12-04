import { createApproveTransaction } from '@/liquidity-manager/utils/transaction'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getSlippage } from '@/liquidity-manager/utils/math'
import { Injectable, Logger } from '@nestjs/common'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { parseUnits } from 'viem'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { Squid } from '@0xsquid/sdk'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'

@Injectable()
export class SquidProviderService implements IRebalanceProvider<'Squid'> {
  private logger = new Logger(SquidProviderService.name)
  private squid: Squid
  private initialized = false
  private initializationPromise: Promise<void> | null = null

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: LmTxGatedKernelAccountClientService,
    private readonly rebalanceRepository: RebalanceRepository,
  ) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Prevent concurrent initialization
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.doInitialize()
    await this.initializationPromise
    this.initialized = true
    this.initializationPromise = null
  }

  private async doInitialize(): Promise<void> {
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

  async isRouteAvailable(tokenIn: TokenData, tokenOut: TokenData): Promise<boolean> {
    await this.ensureInitialized()
    const tokens = this.squid.tokens
    return (
      tokens.some(
        (t) =>
          t.address === tokenIn.config.address &&
          t.chainId.toString() === tokenIn.chainId.toString(),
      ) &&
      tokens.some(
        (t) =>
          t.address === tokenOut.config.address &&
          t.chainId.toString() === tokenOut.chainId.toString(),
      )
    )
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'Squid'>[]> {
    await this.ensureInitialized()

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Squid: getting quote',
        id,
        properties: { tokenIn, tokenOut, swapAmount },
      }),
    )

    if (!(await this.isRouteAvailable(tokenIn, tokenOut))) {
      throw EcoError.RebalancingRouteNotAvailable(
        tokenIn.chainId,
        tokenIn.config.address,
        tokenOut.chainId,
        tokenOut.config.address,
      )
    }

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

      if (route.transactionRequest === undefined) {
        throw EcoError.RebalancingRouteNotFound()
      }

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
    await this.ensureInitialized()

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

      await this.rebalanceRepository.updateStatus(quote.rebalanceJobID!, RebalanceStatus.COMPLETED)
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

      await this.rebalanceRepository.updateStatus(quote.rebalanceJobID!, RebalanceStatus.FAILED)
      throw error
    }
  }
}
