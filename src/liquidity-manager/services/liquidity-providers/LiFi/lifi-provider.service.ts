import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { parseUnits } from 'viem'
import {
  createConfig,
  EVM,
  ExchangeRateUpdateParams,
  executeRoute,
  getRoutes,
  Route,
  RoutesRequest,
  SDKConfig,
} from '@lifi/sdk'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { logLiFiProcess } from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/get-transaction-hashes'
import {
  LiFiAssetCacheManager,
  CacheStatus,
} from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { BalanceService } from '@/balance/balance.service'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { LmTxGatedKernelAccountClientV2Service } from '../../../wallet-wrappers/kernel-gated-client-v2.service'

@Injectable()
export class LiFiProviderService implements OnModuleInit, IRebalanceProvider<'LiFi'> {
  private logger = new Logger(LiFiProviderService.name)
  private walletAddress: string
  private assetCacheManager: LiFiAssetCacheManager

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly kernelAccountClientService: LmTxGatedKernelAccountClientV2Service,
    private readonly rebalanceRepository: RebalanceRepository,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {
    // Initialize the asset cache manager
    this.assetCacheManager = new LiFiAssetCacheManager(this.ecoConfigService, this.logger)
  }

  async onModuleInit() {
    const liFiConfig = this.ecoConfigService.getLiFi()

    // Use first intent source's network as the default network
    const [intentSource] = this.ecoConfigService.getIntentSources()

    const client = await this.kernelAccountClientService.getClient(intentSource.chainID)
    this.walletAddress = client.account!.address

    // Configure LiFi providers
    createConfig({
      integrator: liFiConfig.integrator,
      apiKey: liFiConfig.apiKey,
      rpcUrls: this.getLiFiRPCUrls(),
      providers: [
        EVM({
          getWalletClient: () => Promise.resolve(client) as any,
          switchChain: (chainId) => this.kernelAccountClientService.getClient(chainId) as any,
        }),
      ],
    })

    // Initialize the asset cache
    try {
      await this.assetCacheManager.initialize()
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'LiFi: Asset cache initialized successfully',
        }),
      )
    } catch (error) {
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.LIQUIDITY_MANAGER.LIFI_CACHE_INIT_ERROR,
        error,
        {
          operation: 'asset_cache_initialization',
          service: this.constructor.name,
        },
      )

      this.logger.error(
        EcoLogMessage.withError({
          error,
          message: 'LiFi: Failed to initialize asset cache, continuing with fallback behavior',
        }),
      )
    }
  }

  getStrategy() {
    return 'LiFi' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'LiFi'>> {
    const { swapSlippage, maxQuoteSlippage } = this.ecoConfigService.getLiquidityManager()
    const liFiConfig = this.ecoConfigService.getLiFi()

    // Validate tokens and chains before making API call
    const isValidRoute = this.validateTokenSupport(tokenIn, tokenOut)
    if (!isValidRoute) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'LiFi: Skipping quote request for unsupported token/chain combination',
          properties: {
            fromToken: tokenIn.config.address,
            fromChain: tokenIn.chainId,
            toToken: tokenOut.config.address,
            toChain: tokenOut.chainId,
          },
        }),
      )
      throw EcoError.RebalancingRouteNotFound()
    }

    const routesRequest: RoutesRequest = {
      // Origin chain
      fromAddress: this.walletAddress,
      fromChainId: tokenIn.chainId,
      fromTokenAddress: tokenIn.config.address,
      fromAmount: parseUnits(swapAmount.toString(), tokenIn.balance.decimals).toString(),

      // Destination chain
      toAddress: this.walletAddress,
      toChainId: tokenOut.chainId,
      toTokenAddress: tokenOut.config.address,
      options: {
        slippage: tokenIn.chainId === tokenOut.chainId ? swapSlippage : maxQuoteSlippage,
        bridges: liFiConfig.bridges,
      },
    }

    this.logger.log(
      EcoLogMessage.withId({
        id,
        message: 'LiFi route request',
        properties: { route: routesRequest },
      }),
    )

    const result = await getRoutes(routesRequest)
    const route = this.selectRoute(result.routes)

    // This assumes tokens are 1:1
    const slippage = 1 - parseFloat(route.toAmountMin) / parseFloat(route.fromAmount)

    return {
      amountIn: BigInt(route.fromAmount),
      amountOut: BigInt(route.toAmount),
      slippage,
      tokenIn,
      tokenOut,
      strategy: this.getStrategy(),
      context: route,
      id,
    }
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'LiFi'>) {
    try {
      const kernelWalletAddress = await this.kernelAccountClientService.getAddress()

      if (kernelWalletAddress !== walletAddress) {
        const error = new Error('LiFi is not configured with the provided wallet')
        this.logger.error(
          EcoLogMessage.withErrorAndId({
            error,
            id: quote.id,
            message: error.message,
            properties: {
              groupID: quote.groupID,
              rebalanceJobID: quote.rebalanceJobID,
              walletAddress,
              kernelWalletAddress,
            },
          }),
        )
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
        throw error
      }

      const result = await this._execute(quote)
      this.logger.debug(
        EcoLogMessage.withId({
          id: quote.id,
          message: 'LiFi: Execution result',
          properties: { result },
        }),
      )
      if (quote.rebalanceJobID) {
        await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.COMPLETED)
      }
      return result
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          id: quote.id,
          message: 'LiFi: Execution error',
          error,
        }),
      )
      try {
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
      } catch {}
      throw error
    }
  }

  // Note: fallback routing removed; use configured strategies within main quote loop

  /**
   * Validates if both tokens and chains are supported by LiFi
   * @param tokenIn Source token data
   * @param tokenOut Destination token data
   * @returns true if the route is supported, false otherwise
   */
  private validateTokenSupport(tokenIn: TokenData, tokenOut: TokenData): boolean {
    // Check if chains are supported
    const isFromChainSupported = this.assetCacheManager.isChainSupported(tokenIn.chainId)
    const isToChainSupported = this.assetCacheManager.isChainSupported(tokenOut.chainId)

    if (!isFromChainSupported) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'LiFi: Source chain not supported',
          properties: {
            chainId: tokenIn.chainId,
            token: tokenIn.config.address,
          },
        }),
      )
      return false
    }

    if (!isToChainSupported) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'LiFi: Destination chain not supported',
          properties: {
            chainId: tokenOut.chainId,
            token: tokenOut.config.address,
          },
        }),
      )
      return false
    }

    // Check if tokens are supported on their respective chains
    const isFromTokenSupported = this.assetCacheManager.isTokenSupported(
      tokenIn.chainId,
      tokenIn.config.address,
    )
    const isToTokenSupported = this.assetCacheManager.isTokenSupported(
      tokenOut.chainId,
      tokenOut.config.address,
    )

    if (!isFromTokenSupported) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'LiFi: Source token not supported',
          properties: {
            chainId: tokenIn.chainId,
            token: tokenIn.config.address,
          },
        }),
      )
      return false
    }

    if (!isToTokenSupported) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'LiFi: Destination token not supported',
          properties: {
            chainId: tokenOut.chainId,
            token: tokenOut.config.address,
          },
        }),
      )
      return false
    }

    // Check if tokens are connected (can be swapped/bridged)
    const areConnected = this.assetCacheManager.areTokensConnected(
      tokenIn.chainId,
      tokenIn.config.address,
      tokenOut.chainId,
      tokenOut.config.address,
    )

    if (!areConnected) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'LiFi: Tokens are not connected for swapping/bridging',
          properties: {
            fromChain: tokenIn.chainId,
            fromToken: tokenIn.config.address,
            toChain: tokenOut.chainId,
            toToken: tokenOut.config.address,
          },
        }),
      )
      return false
    }

    return true
  }

  /**
   * Get cache status for monitoring and debugging
   * @returns Current cache status
   */
  getCacheStatus(): CacheStatus {
    return this.assetCacheManager.getCacheStatus()
  }

  async _execute(quote: RebalanceQuote<'LiFi'>) {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'LiFiProviderService: executing quote',
        id: quote.id,
        properties: {
          groupID: quote.groupID,
          rebalanceJobID: quote.rebalanceJobID,
          tokenIn: quote.tokenIn.config.address,
          chainIn: quote.tokenIn.config.chainId,
          tokenOut: quote.tokenOut.config.address,
          chainOut: quote.tokenOut.config.chainId,
          amountIn: quote.amountIn,
          amountOut: quote.amountOut,
          slippage: quote.slippage,
          gasCostUSD: quote.context.gasCostUSD,
          steps: quote.context.steps.map((step) => ({
            type: step.type,
            tool: step.tool,
          })),
        },
      }),
    )

    // Execute the quote
    return executeRoute(quote.context, {
      disableMessageSigning: true,
      updateRouteHook: (route) => logLiFiProcess(this.logger, route),
      acceptExchangeRateUpdateHook: (params: ExchangeRateUpdateParams) => {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'LiFi: Exchange rate update',
            properties: { params },
          }),
        )
        return Promise.resolve(true)
      },
    })
  }

  private selectRoute(routes: Route[]): Route {
    const [route] = routes
    if (!route) throw EcoError.RebalancingRouteNotFound()
    return route
  }

  private getLiFiRPCUrls() {
    const rpcUrl = this.ecoConfigService.getChainRpcs()
    const lifiRPCUrls: SDKConfig['rpcUrls'] = {}

    for (const chainId in rpcUrl) {
      lifiRPCUrls[parseInt(chainId)] = [rpcUrl[chainId]]
    }

    return lifiRPCUrls
  }

  /**
   * Cleanup resources when service is destroyed
   */
  onModuleDestroy() {
    this.assetCacheManager.destroy()
  }
}
