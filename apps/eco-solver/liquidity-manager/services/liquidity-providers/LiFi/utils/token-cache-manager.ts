import { Logger } from '@nestjs/common'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { EcoConfigService } from '@eco/infrastructure-config'
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
  private logger: Logger
  private isInitialized: boolean = false
  private initializationPromise?: Promise<void>
  private config: LiFiCacheConfig

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    logger: Logger,
    config?: Partial<LiFiCacheConfig>,
  ) {
    this.logger = logger

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
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'LiFi: Asset cache disabled by configuration',
        }),
      )
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
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'LiFi: Initializing asset cache',
      }),
    )

    try {
      await this.refreshCache()
      this.setupRefreshTimer()
      this.isInitialized = true

      const status = this.getCacheStatus()
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'LiFi: Asset cache initialized successfully',
          properties: {
            totalChains: status.totalChains,
            totalTokens: status.totalTokens,
            cacheExpiresAt: status.nextRefresh,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          error: error instanceof Error ? error : new Error(String(error)),
          message: 'LiFi: Failed to initialize asset cache',
        }),
      )

      // Use fallback behavior - allow all tokens but log warnings
      this.isInitialized = true
      throw error
    }
  }

  /**
   * Refresh the asset cache by fetching latest data from LiFi
   */
  async refreshCache(): Promise<void> {
    const maxRetries = this.config.maxRetries
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'LiFi: Fetching supported assets',
            properties: { attempt, maxRetries },
          }),
        )

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

        this.logger.log(
          EcoLogMessage.fromDefault({
            message: 'LiFi: Asset cache refreshed successfully',
            properties: {
              chains: totalChains,
              totalTokens,
            },
          }),
        )

        return
      } catch (error) {
        lastError = error as Error
        this.logger.warn(
          EcoLogMessage.withError({
            error: error instanceof Error ? error : new Error(String(error)),
            message: 'LiFi: Failed to fetch supported assets',
            properties: {
              attempt,
              maxRetries,
              willRetry: attempt < maxRetries,
            },
          }),
        )

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * this.config.retryDelayMs
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    // All retries failed
    throw lastError || new Error('Failed to fetch LiFi supported assets after all retries')
  }

  /**
   * Check if a token is supported by LiFi on a specific chain
   * @param chainId The chain ID
   * @param tokenAddress The token address to check
   * @returns true if the token is supported, false otherwise
   */
  isTokenSupported(chainId: number, tokenAddress: string): boolean {
    // If cache is not initialized or expired, use fallback behavior
    if (!this.isInitialized || !this.isCacheValid()) {
      if (this.config.fallbackBehavior === 'allow-all') {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'LiFi: Asset cache not ready, allowing token by default',
            properties: { chainId, tokenAddress },
          }),
        )
        return true
      } else {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'LiFi: Asset cache not ready, denying token by default',
            properties: { chainId, tokenAddress },
          }),
        )
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
  isChainSupported(chainId: number): boolean {
    // If cache is not initialized or expired, use fallback behavior
    if (!this.isInitialized || !this.isCacheValid()) {
      if (this.config.fallbackBehavior === 'allow-all') {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'LiFi: Asset cache not ready, allowing chain by default',
            properties: { chainId },
          }),
        )
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
  areTokensConnected(
    fromChain: number,
    fromToken: string,
    toChain: number,
    toToken: string,
  ): boolean {
    // Return true if both tokens are supported on their respective chains
    return this.isTokenSupported(fromChain, fromToken) && this.isTokenSupported(toChain, toToken)
  }

  /**
   * Get all supported chains
   * @returns Array of supported chain information
   */
  getSupportedChains(): ChainInfo[] {
    return Array.from(this.cache.chains.values())
  }

  /**
   * Get all supported tokens for a specific chain
   * @param chainId The chain ID
   * @returns Set of supported token addresses for the chain
   */
  getSupportedTokensForChain(chainId: number): Set<string> | undefined {
    return this.cache.tokens.get(chainId)
  }

  /**
   * Get cache status information
   * @returns Current cache status
   */
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
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'LiFi: Starting scheduled cache refresh',
          }),
        )
        await this.refreshCache()
      } catch (error) {
        this.logger.error(
          EcoLogMessage.withError({
            error: error instanceof Error ? error : new Error(String(error)),
            message: 'LiFi: Failed to refresh asset cache on schedule',
          }),
        )
      }
    }, this.config.refreshInterval)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'LiFi: Cache refresh timer scheduled',
        properties: {
          refreshIntervalMs: this.config.refreshInterval,
          nextRefreshAt: new Date(Date.now() + this.config.refreshInterval),
        },
      }),
    )
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
  destroy(): void {
    this.clearRefreshTimer()
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'LiFi: Asset cache manager destroyed',
      }),
    )
  }
}
