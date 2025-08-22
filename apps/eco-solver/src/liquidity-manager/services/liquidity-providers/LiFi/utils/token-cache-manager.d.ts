import { Logger } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    chainId: number;
    name: string;
    logoURI?: string;
    priceUSD?: string;
}
interface ChainInfo {
    id: number;
    key: string;
    name: string;
    chainType: 'EVM' | 'SVM';
    nativeToken?: TokenInfo;
}
export interface CacheStatus {
    isInitialized: boolean;
    isValid: boolean;
    lastUpdated: Date;
    nextRefresh: Date;
    totalChains: number;
    totalTokens: number;
    cacheAge: number;
}
interface LiFiCacheConfig {
    enabled: boolean;
    ttl: number;
    refreshInterval: number;
    maxRetries: number;
    retryDelayMs: number;
    fallbackBehavior: 'allow-all' | 'deny-unknown';
}
export declare class LiFiAssetCacheManager {
    private readonly ecoConfigService;
    private cache;
    private refreshTimer?;
    private logger;
    private isInitialized;
    private initializationPromise?;
    private config;
    constructor(ecoConfigService: EcoConfigService, logger: Logger, config?: Partial<LiFiCacheConfig>);
    /**
     * Initialize the asset cache by fetching supported tokens and chains from LiFi
     * This method is idempotent and thread-safe
     */
    initialize(): Promise<void>;
    private performInitialization;
    /**
     * Refresh the asset cache by fetching latest data from LiFi
     */
    refreshCache(): Promise<void>;
    /**
     * Check if a token is supported by LiFi on a specific chain
     * @param chainId The chain ID
     * @param tokenAddress The token address to check
     * @returns true if the token is supported, false otherwise
     */
    isTokenSupported(chainId: number, tokenAddress: string): boolean;
    /**
     * Check if a chain is supported by LiFi
     * @param chainId The chain ID to check
     * @returns true if the chain is supported, false otherwise
     */
    isChainSupported(chainId: number): boolean;
    /**
     * Check if two tokens are connected (can be swapped/bridged)
     * @param fromChain Source chain ID
     * @param fromToken Source token address
     * @param toChain Destination chain ID
     * @param toToken Destination token address
     * @returns true if both tokens are supported on their respective chains
     */
    areTokensConnected(fromChain: number, fromToken: string, toChain: number, toToken: string): boolean;
    /**
     * Get all supported chains
     * @returns Array of supported chain information
     */
    getSupportedChains(): ChainInfo[];
    /**
     * Get all supported tokens for a specific chain
     * @param chainId The chain ID
     * @returns Set of supported token addresses for the chain
     */
    getSupportedTokensForChain(chainId: number): Set<string> | undefined;
    /**
     * Get cache status information
     * @returns Current cache status
     */
    getCacheStatus(): CacheStatus;
    /**
     * Check if the cache is still valid based on TTL
     */
    private isCacheValid;
    /**
     * Normalize token address to lowercase for consistent comparison
     */
    private normalizeAddress;
    /**
     * Setup automatic cache refresh based on refresh interval
     */
    private setupRefreshTimer;
    /**
     * Clear the refresh timer
     */
    private clearRefreshTimer;
    /**
     * Cleanup resources (call this when service is destroyed)
     */
    destroy(): void;
}
export {};
