import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { formatUnits, parseUnits } from 'viem'
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
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { RpcBalanceService } from '@/balance/services/rpc-balance.service'

@Injectable()
export class LiFiProviderService implements OnModuleInit, IRebalanceProvider<'LiFi'> {
  private logger = new Logger(LiFiProviderService.name)
  private walletAddress: string
  private assetCacheManager: LiFiAssetCacheManager

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: RpcBalanceService,
    private readonly kernelAccountClientService: KernelAccountClientV2Service,
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
    const { swapSlippage } = this.ecoConfigService.getLiquidityManager()

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
    }

    if (routesRequest.fromChainId === routesRequest.toChainId && swapSlippage) {
      routesRequest.options = { ...routesRequest.options, slippage: swapSlippage }
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
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
      slippage: slippage,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      strategy: this.getStrategy(),
      context: route,
      id,
    }
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'LiFi'>) {
    const kernelWalletAddress = await this.kernelAccountClientService.getAddress()

    if (kernelWalletAddress !== walletAddress) {
      const error = new Error('LiFi is not configured with the provided wallet')
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          id: quote.id,
          message: error.message,
          properties: { walletAddress, kernelWalletAddress },
        }),
      )
      throw error
    }

    return this._execute(quote)
  }

  /**
   * Attempts to get a quote by routing through a core token when no direct route exists
   * @param tokenIn The source token
   * @param tokenOut The destination token
   * @param swapAmount The amount to swap
   * @returns A quote for the route through a core token
   */
  async fallback(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote[]> {
    // Log that we're using the fallback method with core tokens
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'LiFi: Using fallback method with core tokens',
        properties: {
          fromToken: tokenIn.config.address,
          fromChain: tokenIn.chainId,
          toToken: tokenOut.config.address,
          toChain: tokenOut.chainId,
        },
      }),
    )

    // Try each core token as an intermediary
    const { coreTokens } = this.ecoConfigService.getLiquidityManager()

    for (const coreToken of coreTokens) {
      try {
        // Create core token data structure
        const coreTokenConfig: TokenConfig = {
          address: coreToken.token,
          chainId: coreToken.chainID,
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        }
        const [coreTokenData] = await this.balanceService.getAllTokenDataForAddress(
          this.walletAddress,
          [coreTokenConfig],
        )

        // Validate core token route before attempting
        if (!this.validateTokenSupport(tokenIn, coreTokenData)) {
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: 'LiFi: Skipping core token route due to unsupported token/chain',
              properties: {
                coreToken: coreToken.token,
                coreChain: coreToken.chainID,
              },
            }),
          )
          continue
        }

        // Try routing through core token
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Trying core token as intermediary',
            properties: {
              coreToken: coreToken.token,
              coreChain: coreToken.chainID,
            },
          }),
        )

        const coreTokenQuote = await this.getQuote(tokenIn, coreTokenData, swapAmount)

        const toAmountMin = parseFloat(
          formatUnits(BigInt(coreTokenQuote.context.toAmountMin), coreTokenData.balance.decimals),
        )

        const rebalanceQuote = await this.getQuote(coreTokenData, tokenOut, toAmountMin)

        return [coreTokenQuote, rebalanceQuote]
      } catch (coreError) {
        this.ecoAnalytics.trackError(
          ANALYTICS_EVENTS.LIQUIDITY_MANAGER.LIFI_CORE_TOKEN_ROUTE_ERROR,
          coreError,
          {
            coreToken: coreToken.token,
            coreChain: coreToken.chainID,
            fromToken: tokenIn.config.address,
            fromChain: tokenIn.chainId,
            toToken: tokenOut.config.address,
            toChain: tokenOut.chainId,
            swapAmount,
            operation: 'core_token_fallback',
            service: this.constructor.name,
          },
        )

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Failed to route through core token',
            properties: {
              coreToken: coreToken.token,
              coreChain: coreToken.chainID,
              error: coreError instanceof Error ? coreError.message : String(coreError),
            },
          }),
        )
      }
    }

    // If we get here, no core token route worked
    throw EcoError.RebalancingRouteNotFound()
  }

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
