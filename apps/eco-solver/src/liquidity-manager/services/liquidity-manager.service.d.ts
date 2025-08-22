import { Model } from 'mongoose';
import { FlowProducer } from 'bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import { LiquidityManagerQueueType } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { RebalanceJobData } from '@eco-solver/liquidity-manager/jobs/rebalance.job';
import { LiquidityProviderService } from '@eco-solver/liquidity-manager/services/liquidity-provider.service';
import { EcoConfigService } from '@libs/solver-config';
import { RebalanceModel } from '@eco-solver/liquidity-manager/schemas/rebalance.schema';
import { RebalanceQuote, RebalanceRequest, TokenData, TokenDataAnalyzed } from '@eco-solver/liquidity-manager/types/types';
import { CrowdLiquidityService } from '@eco-solver/intent/crowd-liquidity.service';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { EcoAnalyticsService } from '@eco-solver/analytics/eco-analytics.service';
import { BalanceService } from '@eco-solver/balance/balance.service';
export declare class LiquidityManagerService implements OnApplicationBootstrap {
    private readonly queue;
    protected liquidityManagerFlowProducer: FlowProducer;
    private readonly rebalanceModel;
    readonly balanceService: BalanceService;
    private readonly ecoConfigService;
    readonly liquidityProviderManager: LiquidityProviderService;
    readonly kernelAccountClientService: KernelAccountClientService;
    readonly crowdLiquidityService: CrowdLiquidityService;
    private readonly ecoAnalytics;
    private logger;
    private config;
    private readonly liquidityManagerQueue;
    private readonly tokensPerWallet;
    constructor(queue: LiquidityManagerQueueType, liquidityManagerFlowProducer: FlowProducer, rebalanceModel: Model<RebalanceModel>, balanceService: BalanceService, ecoConfigService: EcoConfigService, liquidityProviderManager: LiquidityProviderService, kernelAccountClientService: KernelAccountClientService, crowdLiquidityService: CrowdLiquidityService, ecoAnalytics: EcoAnalyticsService);
    onApplicationBootstrap(): Promise<void>;
    initializeRebalances(): Promise<void>;
    analyzeTokens(walletAddress: string): Promise<{
        items: TokenDataAnalyzed[];
        surplus: {
            total: number;
            items: TokenDataAnalyzed[];
        };
        inrange: {
            total: number;
            items: TokenDataAnalyzed[];
        };
        deficit: {
            total: number;
            items: TokenDataAnalyzed[];
        };
    }>;
    analyzeToken(token: TokenData): import("@eco-solver/liquidity-manager/types/types").TokenAnalysis;
    /**
     * Gets the optimized rebalancing for the deficit and surplus tokens.
     * @dev The rebalancing is more efficient if done within the same chain.
     *      If it's not possible, other chains are considered.
     * @param walletAddress
     * @param deficitToken
     * @param surplusTokens
     */
    getOptimizedRebalancing(walletAddress: string, deficitToken: TokenDataAnalyzed, surplusTokens: TokenDataAnalyzed[]): Promise<RebalanceQuote<import("@eco-solver/liquidity-manager/types/types").Strategy>[]>;
    startRebalancing(walletAddress: string, rebalances: RebalanceRequest[]): Promise<import("bullmq").JobNode>;
    executeRebalancing(rebalanceData: RebalanceJobData): Promise<void>;
    storeRebalancing(walletAddress: string, request: RebalanceRequest): Promise<void>;
    /**
     * Checks if a swap is possible between the deficit and surplus tokens.
     * @dev swaps are possible if the deficit is compensated by the surplus of tokens in the same chain.
     * @param walletAddress
     * @param deficitToken
     * @param surplusTokens
     * @private
     */
    private getSwapQuotes;
    /**
     * Checks if a rebalancing is possible between the deficit and surplus tokens.
     * @param walletAddress
     * @param deficitToken
     * @param surplusTokens
     * @private
     */
    private getRebalancingQuotes;
}
