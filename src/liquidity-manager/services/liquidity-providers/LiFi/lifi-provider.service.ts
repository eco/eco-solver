import { Injectable, OnModuleInit } from '@nestjs/common'
import { formatUnits, parseUnits } from 'viem'
import {
  createConfig,
  EVM,
  executeRoute,
  getRoutes,
  Route,
  RoutesRequest,
  SDKConfig,
} from '@lifi/sdk'
import { EcoError } from '@/common/errors/eco-error'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import {
  LiFiAssetCacheManager,
  CacheStatus,
} from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { BalanceService } from '@/balance/balance.service'
import { TokenConfig } from '@/balance/types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

@Injectable()
export class LiFiProviderService implements OnModuleInit, IRebalanceProvider<'LiFi'> {
  private logger = new LiquidityManagerLogger('LiFiProviderService')
  private walletAddress: string
  private assetCacheManager: LiFiAssetCacheManager

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly kernelAccountClientService: KernelAccountClientV2Service,
    private readonly rebalanceRepository: RebalanceRepository,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {
    // Initialize the asset cache manager
    this.assetCacheManager = new LiFiAssetCacheManager(this.ecoConfigService)
  }

  @LogOperation('provider_bootstrap', LiquidityManagerLogger)
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
      // Asset cache initialization success is automatically logged by decorator
    } catch (error) {
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.LIQUIDITY_MANAGER.LIFI_CACHE_INIT_ERROR,
        error,
        {
          operation: 'asset_cache_initialization',
          service: this.constructor.name,
        },
      )
      // Asset cache initialization failure is automatically logged by decorator
    }
  }

  getStrategy() {
    return 'LiFi' as const
  }

  @LogOperation('provider_quote_generation', LiquidityManagerLogger)
  async getQuote(
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
    @LogContext id?: string,
  ): Promise<RebalanceQuote<'LiFi'>> {
    const { swapSlippage } = this.ecoConfigService.getLiquidityManager()

    // Validate tokens and chains before making API call
    const isValidRoute = this.validateTokenSupport(tokenIn, tokenOut)
    if (!isValidRoute) {
      // Add business event logging for domain validation
      this.logger.logProviderDomainValidation(
        'LiFi',
        `${tokenIn.chainId}-${tokenOut.chainId}`,
        false,
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

    // Add business event logging for quote generation attempt
    this.logger.logProviderQuoteGeneration('LiFi', routesRequest, true)

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

  @LogOperation('provider_execution', LiquidityManagerLogger)
  async execute(@LogContext walletAddress: string, @LogContext quote: RebalanceQuote<'LiFi'>) {
    try {
      const kernelWalletAddress = await this.kernelAccountClientService.getAddress()

      if (kernelWalletAddress !== walletAddress) {
        const error = new Error('LiFi is not configured with the provided wallet')
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
        throw error
      }

      // Add business event logging for provider execution
      this.logger.logProviderExecution('LiFi', walletAddress, quote)

      await this._execute(quote)
      if (quote.rebalanceJobID) {
        await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.COMPLETED)
      }
    } catch (error) {
      try {
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
      } catch {}
      throw error
    }
  }

  /**
   * Attempts to get a quote by routing through a core token when no direct route exists
   * @param tokenIn The source token
   * @param tokenOut The destination token
   * @param swapAmount The amount to swap
   * @returns A quote for the route through a core token
   */
  @LogOperation('provider_fallback', LiquidityManagerLogger)
  async fallback(
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
  ): Promise<RebalanceQuote[]> {
    // Add business event logging for fallback quote generation
    this.logger.logFallbackQuoteGeneration(tokenIn, tokenOut, swapAmount, false)

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
          // Domain validation failure is logged by the validate method decorator
          continue
        }

        // Core token routing is automatically logged by decorator

        const coreTokenQuote = await this.getQuote(tokenIn, coreTokenData, swapAmount)

        const toAmountMin = parseFloat(
          formatUnits(BigInt(coreTokenQuote.context.toAmountMin), coreTokenData.balance.decimals),
        )

        const rebalanceQuote = await this.getQuote(coreTokenData, tokenOut, toAmountMin)

        // Log successful fallback quote generation
        this.logger.logFallbackQuoteGeneration(tokenIn, tokenOut, swapAmount, true)

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
        // Core token fallback failure is automatically logged by decorator
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
      this.logger.logProviderDomainValidation('LiFi', tokenIn.chainId.toString(), false)
      return false
    }

    if (!isToChainSupported) {
      this.logger.logProviderDomainValidation('LiFi', tokenOut.chainId.toString(), false)
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
      this.logger.logProviderDomainValidation(
        'LiFi',
        `${tokenIn.chainId}-${tokenIn.config.address}`,
        false,
      )
      return false
    }

    if (!isToTokenSupported) {
      this.logger.logProviderDomainValidation(
        'LiFi',
        `${tokenOut.chainId}-${tokenOut.config.address}`,
        false,
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
      this.logger.logProviderDomainValidation(
        'LiFi',
        `${tokenIn.chainId}:${tokenIn.config.address}-${tokenOut.chainId}:${tokenOut.config.address}`,
        false,
      )
      return false
    }

    // Log successful domain validation
    this.logger.logProviderDomainValidation(
      'LiFi',
      `${tokenIn.chainId}:${tokenIn.config.address}-${tokenOut.chainId}:${tokenOut.config.address}`,
      true,
    )
    return true
  }

  /**
   * Get cache status for monitoring and debugging
   * @returns Current cache status
   */
  getCacheStatus(): CacheStatus {
    return this.assetCacheManager.getCacheStatus()
  }

  @LogOperation('provider_execution_internal', LiquidityManagerLogger)
  async _execute(@LogContext quote: RebalanceQuote<'LiFi'>) {
    // Quote execution details are automatically logged by decorator

    // Execute the quote
    return executeRoute(quote.context, {
      disableMessageSigning: true,
      updateRouteHook: () => {
        // Route updates are automatically logged by decorator
      },
      acceptExchangeRateUpdateHook: () => {
        // Exchange rate updates are automatically logged by decorator
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
