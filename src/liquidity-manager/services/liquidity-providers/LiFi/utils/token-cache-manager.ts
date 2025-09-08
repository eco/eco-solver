import { GenericOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { getTokens, getChains, ChainType } from '@lifi/sdk'

interface TokenInfo {
  address: string
  symbol: string
  decimals: number
  chainId: number
  name: string
  logoURI?: string
  priceUSD?: string
}

interface ChainInfo {
  id: number
  key: string
  name: string
  chainType: 'EVM' | 'SVM'
  nativeToken?: TokenInfo
}

interface LiFiSupportedAssets {
  // Supported chains with metadata
  chains: Map<number, ChainInfo>

  // Map of chainId -> Set of lowercase token addresses
  tokens: Map<number, Set<string>>

  // Cache metadata
  metadata: {
    lastUpdated: Date
    ttl: number // Default: 1 hour
  }
}

export interface CacheStatus {
  isInitialized: boolean
  isValid: boolean
  lastUpdated: Date
  nextRefresh: Date
  totalChains: number
  totalTokens: number
  cacheAge: number
}

interface LiFiCacheConfig {
  enabled: boolean
  ttl: number // Cache duration in ms
  refreshInterval: number // How often to refresh
  maxRetries: number
  retryDelayMs: number
  fallbackBehavior: 'allow-all' | 'deny-unknown'
}

export class LiFiAssetCacheManager {
  private cache: LiFiSupportedAssets
  private refreshTimer?: NodeJS.Timeout
  private logger = new GenericOperationLogger('LiFiAssetCacheManager')
  private isInitialized: boolean = false
  private initializationPromise?: Promise<void>
  private config: LiFiCacheConfig

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    config?: Partial<LiFiCacheConfig>,
  ) {
    // Default configuration
    this.config = {
      enabled: true,
      ttl: 3600000, // 1 hour
      refreshInterval: 3240000, // 90% of TTL
      maxRetries: 3,
      retryDelayMs: 1000,
      fallbackBehavior: 'allow-all',
      ...config,
    }

    this.cache = {
      chains: new Map(),
      tokens: new Map(),
      metadata: {
        lastUpdated: new Date(0),
        ttl: this.config.ttl,
      },
    }
  }

  /**
   * Initialize the asset cache by fetching supported tokens and chains from LiFi
   * This method is idempotent and thread-safe
   */
  @LogOperation('provider_bootstrap', GenericOperationLogger)
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    // Return existing initialization if in progress
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    // Return immediately if already initialized and cache is still valid
    if (this.isInitialized && this.isCacheValid()) {
      return
    }

    // Start new initialization
    this.initializationPromise = this.performInitialization()

    try {
      await this.initializationPromise
    } finally {
      this.initializationPromise = undefined
    }
  }

  private async performInitialization(): Promise<void> {
    try {
      await this.refreshCache()
      this.setupRefreshTimer()
      this.isInitialized = true

      // Log successful initialization as business event
      const status = this.getCacheStatus()
      this.logger.logInfrastructureOperation(
        'LiFiAssetCacheManager',
        'cache_initialization',
        true,
        {
          totalChains: status.totalChains,
          totalTokens: status.totalTokens,
          cacheExpiresAt: status.nextRefresh,
        },
      )
    } catch (error) {
      // Log failed initialization as business event
      this.logger.logInfrastructureOperation(
        'LiFiAssetCacheManager',
        'cache_initialization',
        false,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      )

      // Use fallback behavior - allow all tokens but log warnings
      this.isInitialized = true
      throw error
    }
  }

  /**
   * Refresh the asset cache by fetching latest data from LiFi
   */
  @LogOperation('infrastructure_operation', GenericOperationLogger)
  async refreshCache(): Promise<void> {
    const maxRetries = this.config.maxRetries
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Fetch both chains and tokens in parallel
        const [chainsResponse, tokensResponse] = await Promise.all([
          getChains({ chainTypes: [ChainType.EVM] }),
          getTokens(),
        ])

        // Clear existing cache
        this.cache.chains.clear()
        this.cache.tokens.clear()

        // Process chains
        let totalChains = 0
        for (const chain of chainsResponse) {
          const chainInfo: ChainInfo = {
            id: chain.id,
            key: chain.key,
            name: chain.name,
            chainType: 'EVM', // Currently only supporting EVM chains
            nativeToken: chain.nativeToken
              ? {
                  address: chain.nativeToken.address,
                  symbol: chain.nativeToken.symbol,
                  decimals: chain.nativeToken.decimals,
                  chainId: chain.id,
                  name: chain.nativeToken.name,
                  logoURI: chain.nativeToken.logoURI,
                  priceUSD: chain.nativeToken.priceUSD,
                }
              : undefined,
          }

          this.cache.chains.set(chain.id, chainInfo)
          totalChains++
        }

        // Process tokens by chain
        let totalTokens = 0
        for (const [chainId, tokens] of Object.entries(tokensResponse.tokens)) {
          const chainIdNum = parseInt(chainId)
          const tokenAddresses = new Set<string>()

          for (const token of tokens as TokenInfo[]) {
            // Store addresses in lowercase for case-insensitive comparison
            tokenAddresses.add(token.address.toLowerCase())
            totalTokens++
          }

          this.cache.tokens.set(chainIdNum, tokenAddresses)
        }

        this.cache.metadata.lastUpdated = new Date()

        // Log successful cache refresh as business event
        this.logger.logInfrastructureOperation('LiFiAssetCacheManager', 'cache_refresh', true, {
          chains: totalChains,
          totalTokens,
          attempt,
        })

        return
      } catch (error) {
        lastError = error as Error

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * this.config.retryDelayMs
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    // All retries failed - log as business event
    const error = lastError || new Error('Failed to fetch LiFi supported assets after all retries')
    this.logger.logInfrastructureOperation('LiFiAssetCacheManager', 'cache_refresh', false, {
      maxRetries,
      error: error.message,
    })

    throw error
  }

  /**
   * Check if a token is supported by LiFi on a specific chain
   * @param chainId The chain ID
   * @param tokenAddress The token address to check
   * @returns true if the token is supported, false otherwise
   */
  @LogOperation('provider_validation', GenericOperationLogger)
  isTokenSupported(@LogContext chainId: number, @LogContext tokenAddress: string): boolean {
    // If cache is not initialized or expired, use fallback behavior
    if (!this.isInitialized || !this.isCacheValid()) {
      if (this.config.fallbackBehavior === 'allow-all') {
        return true
      } else {
        return false
      }
    }

    const chainTokens = this.cache.tokens.get(chainId)
    if (!chainTokens) {
      return false
    }

    // Normalize address for comparison
    const normalizedAddress = this.normalizeAddress(tokenAddress)
    return chainTokens.has(normalizedAddress)
  }

  /**
   * Check if a chain is supported by LiFi
   * @param chainId The chain ID to check
   * @returns true if the chain is supported, false otherwise
   */
  @LogOperation('provider_validation', GenericOperationLogger)
  isChainSupported(@LogContext chainId: number): boolean {
    // If cache is not initialized or expired, use fallback behavior
    if (!this.isInitialized || !this.isCacheValid()) {
      if (this.config.fallbackBehavior === 'allow-all') {
        return true
      } else {
        return false
      }
    }

    return this.cache.chains.has(chainId)
  }

  /**
   * Check if two tokens are connected (can be swapped/bridged)
   * @param fromChain Source chain ID
   * @param fromToken Source token address
   * @param toChain Destination chain ID
   * @param toToken Destination token address
   * @returns true if both tokens are supported on their respective chains
   */
  @LogOperation('provider_validation', GenericOperationLogger)
  areTokensConnected(
    @LogContext fromChain: number,
    @LogContext fromToken: string,
    @LogContext toChain: number,
    @LogContext toToken: string,
  ): boolean {
    // Return true if both tokens are supported on their respective chains
    return this.isTokenSupported(fromChain, fromToken) && this.isTokenSupported(toChain, toToken)
  }

  /**
   * Get all supported chains
   * @returns Array of supported chain information
   */
  @LogOperation('infrastructure_operation', GenericOperationLogger)
  getSupportedChains(): ChainInfo[] {
    return Array.from(this.cache.chains.values())
  }

  /**
   * Get all supported tokens for a specific chain
   * @param chainId The chain ID
   * @returns Set of supported token addresses for the chain
   */
  @LogOperation('infrastructure_operation', GenericOperationLogger)
  getSupportedTokensForChain(@LogContext chainId: number): Set<string> | undefined {
    return this.cache.tokens.get(chainId)
  }

  /**
   * Get cache status information
   * @returns Current cache status
   */
  @LogOperation('infrastructure_operation', GenericOperationLogger)
  getCacheStatus(): CacheStatus {
    const now = new Date()
    const cacheAge = now.getTime() - this.cache.metadata.lastUpdated.getTime()
    const nextRefresh = new Date(
      this.cache.metadata.lastUpdated.getTime() + this.config.refreshInterval,
    )

    let totalTokens = 0
    for (const tokenSet of this.cache.tokens.values()) {
      totalTokens += tokenSet.size
    }

    return {
      isInitialized: this.isInitialized,
      isValid: this.isCacheValid(),
      lastUpdated: this.cache.metadata.lastUpdated,
      nextRefresh,
      totalChains: this.cache.chains.size,
      totalTokens,
      cacheAge,
    }
  }

  /**
   * Check if the cache is still valid based on TTL
   */
  private isCacheValid(): boolean {
    const now = new Date().getTime()
    const cacheAge = now - this.cache.metadata.lastUpdated.getTime()
    return cacheAge < this.cache.metadata.ttl
  }

  /**
   * Normalize token address to lowercase for consistent comparison
   */
  private normalizeAddress(address: string): string {
    return address.toLowerCase()
  }

  /**
   * Setup automatic cache refresh based on refresh interval
   */
  private setupRefreshTimer(): void {
    this.clearRefreshTimer()

    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshCache()
      } catch (error) {
        // Error is already logged by the decorator, we just silently handle it here
      }
    }, this.config.refreshInterval)

    // Log timer setup as business event
    this.logger.logInfrastructureOperation('LiFiAssetCacheManager', 'cache_timer_setup', true, {
      refreshIntervalMs: this.config.refreshInterval,
      nextRefreshAt: new Date(Date.now() + this.config.refreshInterval),
    })
  }

  /**
   * Clear the refresh timer
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
  }

  /**
   * Cleanup resources (call this when service is destroyed)
   */
  @LogOperation('infrastructure_operation', GenericOperationLogger)
  destroy(): void {
    this.clearRefreshTimer()

    // Log destruction as business event
    this.logger.logInfrastructureOperation('LiFiAssetCacheManager', 'cache_destroy', true, {
      wasInitialized: this.isInitialized,
    })
  }
}
