import { ConfigSource } from './interfaces/config-source.interface';
import { AwsCredential, EcoConfigType, IntentSource, KmsConfig, SafeType, Solver } from './eco-config.types';
import { Chain } from 'viem';
import { TransportConfig } from '@eco-solver/common/chains/transport';
/**
 * Service class for managing application configuration from multiple sources.
 *
 * Configuration hierarchy and merging strategy:
 * 1. External configs (injected via ConfigSource providers) - lowest priority
 * 2. Static configs from config package (from /config directory) - medium priority
 * 3. Environment variables and runtime configs - highest priority
 *
 * The EcoConfigService works with the following sources:
 * - Static JSON/TS configs in the config/ directory
 * - External configs injected via ConfigSource providers (e.g. AWS secrets)
 * - EcoChains package for blockchain RPC configuration
 *
 * The EcoChains integration:
 * - EcoChains is initialized with RPC API keys from the config
 * - Provides chain-specific configurations including RPC URLs
 * - Handles custom endpoints (Caldera/Alchemy) vs default endpoints
 * - Manages both HTTP and WebSocket connections
 *
 * Config values are merged using deep extend, with latter sources overriding
 * earlier ones when conflicts exist, while preserving non-conflicting values.
 */
export declare class EcoConfigService {
    private readonly sources;
    private logger;
    private externalConfigs;
    private configLoader;
    private ecoChains;
    constructor(sources: ConfigSource[]);
    private getConfigDir;
    /**
     * Returns the static configs for the app, from the custom ConfigLoader
     * @returns the configs
     */
    static getStaticConfig(): EcoConfigType;
    initConfigs(): void;
    get<T>(key: string): T;
    getRpcConfig(): EcoConfigType['rpcs'];
    getAwsConfigs(): AwsCredential[];
    getCache(): EcoConfigType['cache'];
    getFulfill(): EcoConfigType['fulfill'];
    getGaslessIntentdAppIDs(): string[];
    getIntentSources(): EcoConfigType['intentSources'];
    getIntentSource(chainID: number): IntentSource | undefined;
    getKmsConfig(): KmsConfig;
    getSafe(): SafeType;
    getSolvers(): EcoConfigType['solvers'];
    getSolver(chainID: number | bigint): Solver | undefined;
    getLaunchDarkly(): EcoConfigType['launchDarkly'];
    getAnalyticsConfig(): EcoConfigType['analytics'];
    getDatabaseConfig(): EcoConfigType['database'];
    getEth(): EcoConfigType['eth'];
    getIntervals(): EcoConfigType['intervals'];
    getIntentConfigs(): EcoConfigType['intentConfigs'];
    getQuotesConfig(): EcoConfigType['quotesConfig'];
    getSolverRegistrationConfig(): EcoConfigType['solverRegistrationConfig'];
    getExternalAPIs(): EcoConfigType['externalAPIs'];
    getLoggerConfig(): EcoConfigType['logger'];
    getMongooseUri(): string;
    getRedis(): EcoConfigType['redis'];
    getServer(): EcoConfigType['server'];
    getGasEstimationsConfig(): EcoConfigType['gasEstimations'];
    getLiquidityManager(): EcoConfigType['liquidityManager'];
    getWhitelist(): EcoConfigType['whitelist'];
    getHyperlane(): EcoConfigType['hyperlane'];
    getWithdraws(): EcoConfigType['withdraws'];
    getSendBatch(): EcoConfigType['sendBatch'];
    getIndexer(): EcoConfigType['indexer'];
    getCCTP(): EcoConfigType['CCTP'];
    getCCTPV2(): EcoConfigType['CCTPV2'];
    getCrowdLiquidity(): EcoConfigType['crowdLiquidity'];
    getWarpRoutes(): EcoConfigType['warpRoutes'];
    getLiFi(): EcoConfigType['liFi'];
    getSquid(): EcoConfigType['squid'];
    getEverclear(): EcoConfigType['everclear'];
    getChainRpcs(): Record<number, string[]>;
    getCustomRPCUrl(chainID: string): any;
    /**
     * Returns the RPC URL for a given chain, prioritizing custom endpoints (like Caldera or Alchemy)
     * over default ones when available. For WebSocket connections, returns WebSocket URLs when available.
     * @param chain The chain object to get the RPC URL for
     * @returns The RPC URL string for the specified chain
     */
    getRpcUrls(chain: Chain): {
        rpcUrls: string[];
        config: TransportConfig;
    };
    /**
     * Checks to see what networks we have inbox contracts for
     * @returns the supported chains for the event
     */
    getSupportedChains(): bigint[];
    /**
     * Returns the fulfillment estimate config
     * @returns the fulfillment estimate config
     */
    getFulfillmentEstimateConfig(): EcoConfigType['fulfillmentEstimate'];
    getCCTPLiFiConfig(): EcoConfigType['cctpLiFi'];
}
