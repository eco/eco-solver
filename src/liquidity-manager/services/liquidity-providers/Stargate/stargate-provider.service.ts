import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Hex, parseUnits } from 'viem'
import { Injectable, Logger } from '@nestjs/common'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { StargateQuote } from '@/liquidity-manager/services/liquidity-providers/Stargate/types/stargate-quote.interface'
import { LmTxGatedKernelAccountClientV2Service } from '../../../wallet-wrappers/kernel-gated-client-v2.service'

@Injectable()
export class StargateProviderService implements IRebalanceProvider<'Stargate'> {
  private logger = new Logger(StargateProviderService.name)
  private walletAddress: string
  private chainKeyMap: Record<number, string> = {}
  private initialized = false
  private initializationPromise: Promise<void> | null = null

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: LmTxGatedKernelAccountClientV2Service,
    private readonly multiChainPublicClientService: MultichainPublicClientService,
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
    // Use first intent source's network as the default network
    const [intentSource] = this.ecoConfigService.getIntentSources()

    const client = await this.kernelAccountClientService.getClient(intentSource.chainID)
    this.walletAddress = client.account!.address
  }

  async isRouteAvailable(tokenIn: TokenData, tokenOut: TokenData): Promise<boolean> {
    await this.ensureInitialized()
    const srcChainKey = await this.getChainKey(tokenIn.chainId)
    const dstChainKey = await this.getChainKey(tokenOut.chainId)
    return srcChainKey !== undefined && dstChainKey !== undefined
  }

  getStrategy() {
    return 'Stargate' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'Stargate'>> {
    await this.ensureInitialized()

    if (!(await this.isRouteAvailable(tokenIn, tokenOut))) {
      throw EcoError.RebalancingRouteNotAvailable(
        tokenIn.chainId,
        tokenIn.config.address,
        tokenOut.chainId,
        tokenOut.config.address,
      )
    }

    // Convert chain IDs to Stargate chain keys
    const srcChainKey = await this.getChainKey(tokenIn.chainId)
    const dstChainKey = await this.getChainKey(tokenOut.chainId)

    const amountIn = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)

    // Calculate the minimum amount out using the max slippage without losing precision
    const amountMin = this.calculateAmountMin(amountIn)

    try {
      // Build URL with query parameters
      const params = new URLSearchParams({
        srcToken: tokenIn.config.address,
        dstToken: tokenOut.config.address,
        srcChainKey: srcChainKey!,
        dstChainKey: dstChainKey!,
        srcAddress: this.walletAddress,
        dstAddress: this.walletAddress,
        srcAmount: amountIn.toString(),
        dstAmountMin: amountMin.toString(),
      })

      this.logger.debug(
        EcoLogMessage.withId({
          id,
          message: 'Stargate params',
          properties: { params: params.toString() },
        }),
      )

      // Call Stargate API to get routes
      const response = await fetch(`https://stargate.finance/api/v1/routes?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const routesData: { routes: StargateQuote[] } = await response.json()

      this.logger.debug(
        EcoLogMessage.withId({
          id,
          message: 'Stargate routes',
          properties: { routesData },
        }),
      )

      if (!routesData || !routesData.routes || routesData.routes.length === 0) {
        throw EcoError.RebalancingRouteNotFound()
      }

      // Select the best route (first one is usually the best)
      const route = this.selectRoute(routesData.routes)

      const slippage = 1 - Number(route.dstAmountMin) / Number(route.srcAmount)

      return {
        amountIn: BigInt(route.srcAmount),
        amountOut: BigInt(route.dstAmountMin),
        slippage: slippage,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        strategy: this.getStrategy(),
        context: route,
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          id,
          message: 'Failed to get Stargate route',
          error,
          properties: {
            fromToken: tokenIn.config.address,
            toToken: tokenOut.config.address,
            fromChain: tokenIn.chainId,
            toChain: tokenOut.chainId,
            amount: amountIn.toString(),
          },
        }),
      )
      throw EcoError.RebalancingRouteNotFound()
    }
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'Stargate'>) {
    await this.ensureInitialized()

    try {
      // Verify wallet matches
      const kernelWalletAddress = await this.kernelAccountClientService.getAddress()

      if (kernelWalletAddress !== walletAddress) {
        const error = new Error('Stargate is not configured with the provided wallet')
        this.logger.error(
          EcoLogMessage.withErrorAndId({
            id: quote.id,
            error,
            message: error.message,
            properties: { walletAddress, kernelWalletAddress },
          }),
        )
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
        throw error
      }

      // Execute the quote
      const res = await this._execute(quote)
      if (quote.rebalanceJobID) {
        await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.COMPLETED)
      }
      return res
    } catch (error) {
      try {
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
      } catch {}
      throw error
    }
  }

  private selectRoute(routes: StargateQuote[]): StargateQuote {
    const [route] = routes
    if (!route) throw EcoError.RebalancingRouteNotFound()
    return route
  }

  private async _execute(quote: RebalanceQuote<'Stargate'>) {
    this.logger.debug(
      EcoLogMessage.withId({
        id: quote.id,
        message: 'StargateProviderService: executing quote',
        properties: {
          tokenIn: quote.tokenIn.config.address,
          chainIn: quote.tokenIn.chainId,
          tokenOut: quote.tokenOut.config.address,
          chainOut: quote.tokenOut.chainId,
          amountIn: quote.amountIn.toString(),
          amountOut: quote.amountOut.toString(),
          slippage: quote.slippage,
        },
      }),
    )

    for (const step of quote.context.steps) {
      const { chainKey, transaction } = step
      try {
        // Loop through the steps and execute each one
        const chainId = await this.getChainIdFromChainKey(chainKey)

        // Get the client for the current chain
        const client = await this.kernelAccountClientService.getClient(chainId)

        // Execute the transaction
        const hash = await client.sendTransaction({
          to: transaction.to as Hex,
          data: transaction.data as Hex,
          value: BigInt(transaction.value ?? 0),
        })

        // Wait for transaction confirmation
        const publicClient = await this.multiChainPublicClientService.getClient(chainId)
        await publicClient.waitForTransactionReceipt({ hash })

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Stargate step executed successfully',
            properties: {
              step,
              chainId,
              hash,
            },
          }),
        )
      } catch (error) {
        this.logger.error(
          EcoLogMessage.withErrorAndId({
            id: quote.id,
            message: 'Failed to execute Stargate transfer',
            error,
            properties: {
              quote,
              step,
            },
          }),
        )
        throw error
      }
    }
  }

  /**
   * Gets the chain key for a given chain ID, loading from API if needed
   * @param chainId The chain ID to get the key for
   * @returns The chain key string or undefined if not found
   */
  private async getChainKey(chainId: number): Promise<string | undefined> {
    // If we haven't loaded chains yet or a force load is requested, load them now
    if (Object.keys(this.chainKeyMap).length === 0) {
      await this.loadChainKeys()
    }

    return this.chainKeyMap[chainId]
  }

  /**
   * Gets the chain ID for a given chain key, loading from API if needed
   * @param chainKey The chain key to get the chain id for
   * @returns The corresponding chain id
   */
  private async getChainIdFromChainKey(chainKey: string): Promise<number> {
    // If we haven't loaded chains yet or a force load is requested, load them now
    if (Object.keys(this.chainKeyMap).length === 0) {
      await this.loadChainKeys()
    }

    const chainId = Object.entries(this.chainKeyMap).find((pair) => pair[1] === chainKey)?.[0]

    if (chainId === undefined) {
      throw EcoError.RebalancingRouteNotFound()
    }

    return Number(chainId)
  }

  /**
   * Loads chain keys from Stargate API if they haven't been loaded already
   * @returns A promise that resolves when the chains are loaded
   */
  private async loadChainKeys(): Promise<void> {
    // Create a new loading promise
    try {
      const response = await fetch('https://stargate.finance/api/v1/chains')

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const data: { chains: { chainKey: string; chainId: number }[] } = await response.json()

      // Clear the existing map before populating with fresh data

      // Map chain data to our fresh chain map
      for (const chain of data.chains) {
        if (chain.chainId && chain.chainKey) {
          this.chainKeyMap[chain.chainId] = chain.chainKey
        }
      }

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Stargate chain keys fetched successfully',
          properties: {
            chainCount: Object.keys(this.chainKeyMap).length,
            chains: Object.entries(this.chainKeyMap).map(([chainId, key]) => ({
              chainId,
              key,
            })),
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'Failed to fetch Stargate chain keys, using fallback values',
          error,
        }),
      )

      throw error
    }
  }

  /**
   * Calculates the minimum acceptable destination amount based on the configured
   * maximum slippage. All math is performed with BigInt to avoid precision loss.
   *
   * amountIn * (1 - maxSlippage) is implemented in integer arithmetic by
   * converting the percentage to basis points (bps) and performing a ceil-div.
   */
  private calculateAmountMin(amountIn: bigint): bigint {
    const maxSlippage = this.ecoConfigService.getLiquidityManager().maxQuoteSlippage

    // Use 10_000 bps = 100%
    const BPS_DIVISOR = 10000n

    // Convert percentage (e.g. 0.5 => 50%) to basis points (5000).
    // We floor so we never underestimate required slippage protection.
    const slippageBps = BigInt(Math.floor(maxSlippage * Number(BPS_DIVISOR)))
    const slippageFactor = BPS_DIVISOR - slippageBps

    // Ceil-divide to avoid rounding down which could breach max slippage.
    return (amountIn * slippageFactor + BPS_DIVISOR - 1n) / BPS_DIVISOR
  }
}
