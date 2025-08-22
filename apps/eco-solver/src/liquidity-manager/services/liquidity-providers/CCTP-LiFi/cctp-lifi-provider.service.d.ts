import { EcoConfigService } from '@libs/solver-config';
import { BalanceService } from '@eco-solver/balance/balance.service';
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider';
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types';
import { LiquidityManagerQueueType } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { LiFiProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service';
import { CCTPProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service';
import { EcoAnalyticsService } from '@eco-solver/analytics/eco-analytics.service';
export declare class CCTPLiFiProviderService implements IRebalanceProvider<'CCTPLiFi'> {
    private readonly liFiService;
    private readonly cctpService;
    private readonly ecoConfigService;
    private readonly balanceService;
    private readonly queue;
    private readonly ecoAnalytics;
    private logger;
    private liquidityManagerQueue;
    private config;
    constructor(liFiService: LiFiProviderService, cctpService: CCTPProviderService, ecoConfigService: EcoConfigService, balanceService: BalanceService, queue: LiquidityManagerQueueType, ecoAnalytics: EcoAnalyticsService);
    getStrategy(): "CCTPLiFi";
    getQuote(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number, id?: string): Promise<RebalanceQuote<'CCTPLiFi'>>;
    execute(walletAddress: string, quote: RebalanceQuote<'CCTPLiFi'>): Promise<unknown>;
    /**
     * Builds the route context by getting quotes for each required step
     */
    private buildRouteContext;
    /**
     * Calculates total amount out and slippage for the route
     */
    private calculateTotals;
    /**
     * Creates a USDC TokenData object for the given chain
     */
    private createUSDCTokenData;
    /**
     * Executes source chain swap using LiFi
     */
    private executeSourceSwap;
    /**
     * Extracts the transaction hash from LiFi RouteExtended execution result
     */
    private extractTransactionHashFromLiFiResult;
    /**
     * Executes CCTP bridge operation
     */
    private executeCCTPBridge;
}
