import { CrowdLiquidityService } from '@eco-solver/intent/crowd-liquidity.service';
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types';
import { LiFiProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service';
import { CCTPProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service';
import { WarpRouteProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service';
import { EcoConfigService } from '@libs/solver-config';
import { RelayProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service';
import { StargateProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service';
import { CCTPLiFiProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP-LiFi/cctp-lifi-provider.service';
import { EcoAnalyticsService } from '@eco-solver/analytics/eco-analytics.service';
import { SquidProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service';
import { CCTPV2ProviderService } from './liquidity-providers/CCTP-V2/cctpv2-provider.service';
import { EverclearProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Everclear/everclear-provider.service';
export declare class LiquidityProviderService {
    protected readonly ecoConfigService: EcoConfigService;
    protected readonly liFiProviderService: LiFiProviderService;
    protected readonly cctpProviderService: CCTPProviderService;
    protected readonly crowdLiquidityService: CrowdLiquidityService;
    protected readonly warpRouteProviderService: WarpRouteProviderService;
    protected readonly relayProviderService: RelayProviderService;
    protected readonly stargateProviderService: StargateProviderService;
    protected readonly cctpLiFiProviderService: CCTPLiFiProviderService;
    private readonly ecoAnalytics;
    protected readonly squidProviderService: SquidProviderService;
    protected readonly cctpv2ProviderService: CCTPV2ProviderService;
    protected readonly everclearProviderService: EverclearProviderService;
    private logger;
    private config;
    constructor(ecoConfigService: EcoConfigService, liFiProviderService: LiFiProviderService, cctpProviderService: CCTPProviderService, crowdLiquidityService: CrowdLiquidityService, warpRouteProviderService: WarpRouteProviderService, relayProviderService: RelayProviderService, stargateProviderService: StargateProviderService, cctpLiFiProviderService: CCTPLiFiProviderService, ecoAnalytics: EcoAnalyticsService, squidProviderService: SquidProviderService, cctpv2ProviderService: CCTPV2ProviderService, everclearProviderService: EverclearProviderService);
    getQuote(walletAddress: string, tokenIn: TokenData, tokenOut: TokenData, swapAmount: number): Promise<RebalanceQuote[]>;
    execute(walletAddress: string, quote: RebalanceQuote): Promise<unknown>;
    /**
     * Attempts a route using fallback mechanisms (like core tokens)
     * @param tokenIn The source token
     * @param tokenOut The destination token
     * @param swapAmount The amount to swap
     * @returns A quote using the fallback mechanism
     */
    fallback(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number): Promise<RebalanceQuote[]>;
    private getStrategyService;
    private getWalletSupportedStrategies;
    private formatToken;
    private formatQuoteBatch;
}
