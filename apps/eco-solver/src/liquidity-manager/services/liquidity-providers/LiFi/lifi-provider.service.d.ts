import { OnModuleInit } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { CacheStatus } from '@eco-solver/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager';
import { KernelAccountClientV2Service } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client-v2.service';
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types';
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider';
import { EcoAnalyticsService } from '@eco-solver/analytics/eco-analytics.service';
import { BalanceService } from '@eco-solver/balance/balance.service';
export declare class LiFiProviderService implements OnModuleInit, IRebalanceProvider<'LiFi'> {
    private readonly ecoConfigService;
    private readonly balanceService;
    private readonly kernelAccountClientService;
    private readonly ecoAnalytics;
    private logger;
    private walletAddress;
    private assetCacheManager;
    constructor(ecoConfigService: EcoConfigService, balanceService: BalanceService, kernelAccountClientService: KernelAccountClientV2Service, ecoAnalytics: EcoAnalyticsService);
    onModuleInit(): Promise<void>;
    getStrategy(): "LiFi";
    getQuote(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number, id?: string): Promise<RebalanceQuote<'LiFi'>>;
    execute(walletAddress: string, quote: RebalanceQuote<'LiFi'>): Promise<import("@lifi/sdk").RouteExtended>;
    /**
     * Attempts to get a quote by routing through a core token when no direct route exists
     * @param tokenIn The source token
     * @param tokenOut The destination token
     * @param swapAmount The amount to swap
     * @returns A quote for the route through a core token
     */
    fallback(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number): Promise<RebalanceQuote[]>;
    /**
     * Validates if both tokens and chains are supported by LiFi
     * @param tokenIn Source token data
     * @param tokenOut Destination token data
     * @returns true if the route is supported, false otherwise
     */
    private validateTokenSupport;
    /**
     * Get cache status for monitoring and debugging
     * @returns Current cache status
     */
    getCacheStatus(): CacheStatus;
    _execute(quote: RebalanceQuote<'LiFi'>): Promise<import("@lifi/sdk").RouteExtended>;
    private selectRoute;
    private getLiFiRPCUrls;
    /**
     * Cleanup resources when service is destroyed
     */
    onModuleDestroy(): void;
}
