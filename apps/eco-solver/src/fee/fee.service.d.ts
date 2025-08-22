import { BalanceService, TokenFetchAnalysis } from '@eco-solver/balance/balance.service';
import { EcoConfigService } from '@libs/solver-config';
import { FeeConfigType } from '@libs/solver-config';
import { CalculateTokensType, NormalizedCall, NormalizedToken, NormalizedTotal } from '@eco-solver/fee/types';
import { QuoteIntentDataInterface } from '@eco-solver/quote/dto/quote.intent.data.dto';
import { OnModuleInit } from '@nestjs/common';
import { Hex } from 'viem';
import { QuoteRouteDataInterface } from '@eco-solver/quote/dto/quote.route.data.dto';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * The base decimal number for erc20 tokens.
 */
export declare const BASE_DECIMALS = 6;
export declare class FeeService implements OnModuleInit {
    private readonly balanceService;
    private readonly ecoConfigService;
    private readonly ecoAnalytics;
    private logger;
    private intentConfigs;
    private whitelist;
    constructor(balanceService: BalanceService, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    onModuleInit(): void;
    /**
     * Returns the fee for a transaction, if the intent is provided
     * then it returns a special fee for that intent if there is one,
     * otherwise it returns the default fee
     *
     * @param args
     * @param args.intent the optional intent for the fee
     * @param args.defaultFeeArg the default fee to use if the intent is not provided,
     *                      usually from the solvers own config
     * @returns
     */
    getFeeConfig(args?: {
        intent?: QuoteIntentDataInterface;
        defaultFeeArg?: FeeConfigType;
    }): FeeConfigType;
    /**
     * Calculates the fee for the transaction based on an amount and the intent
     *
     * @param normalizedTotal the amount to use for the fee
     * @param intent the quote intent
     * @returns a bigint representing the fee
     */
    getFee(normalizedTotal: NormalizedTotal, intent: QuoteIntentDataInterface): NormalizedTotal;
    /**
     * Gets the ask for the quote
     *
     * @param totalFulfill the total amount to fulfill, assumes base6
     * @param intent the quote intent
     * @returns a bigint representing the ask
     */
    getAsk(totalFulfill: NormalizedTotal, intent: QuoteIntentDataInterface): NormalizedTotal;
    /**
     * Checks if the route is feasible for the quote intent:
     * 1) the solver can fulfill the transaction
     * 2) the route is profitable for the solver, ie the rewards cover the ask
     * @param quote the quote
     * @returns the error is undefined, error is defined if its not feasible
     */
    isRouteFeasible(quote: QuoteIntentDataInterface): Promise<{
        error?: Error;
    }>;
    isRewardFeasible(quote: QuoteIntentDataInterface): Promise<{
        error?: Error;
    }>;
    /**
     * Calculates the total normalized fill for the quote intent
     *
     * @param quote the quote intent
     * @returns
     */
    getTotalFill(quote: QuoteIntentDataInterface): Promise<{
        totalFillNormalized: NormalizedTotal;
        error?: Error;
    }>;
    /**
     * Calculates the total normalized and acceoted rewards for the quote intent
     * @param quote the quote intent
     * @returns
     */
    getTotalRewards(quote: QuoteIntentDataInterface): Promise<{
        totalRewardsNormalized: NormalizedTotal;
        error?: Error;
    }>;
    /**
     * Gets the solver tokens for the source chain and orders them in
     * a normalized delta descending order. delta = (balance - minBalance) * decimals
     * @param route the route
     * @returns
     */
    calculateTokens(quote: QuoteIntentDataInterface): Promise<{
        calculated?: CalculateTokensType;
        error?: Error;
    }>;
    /**
     * Fetches the rewardes for the quote intent, grabs their info from the erc20 contracts and then converts
     * and normalizes their values
     * @param quote the quote intent
     */
    getRewardsNormalized(quote: QuoteIntentDataInterface): Promise<{
        rewards: NormalizedToken[];
        error?: Error;
    }>;
    getTokensNormalized(quote: QuoteIntentDataInterface): Promise<{
        tokens: NormalizedToken[];
        error?: Error;
    }>;
    /**
     * Fetches the call tokens for the quote intent, grabs their info from the erc20 contracts and then converts
     * to a standard reserve value for comparisons
     *
     * Throws if there is not enough liquidity for the call
     *
     * @param quote the quote intent
     * @param solver the solver for the quote intent
     * @returns
     */
    getCallsNormalized(quote: QuoteIntentDataInterface): Promise<{
        calls: NormalizedCall[];
        error: Error | undefined;
    }>;
    private getNormalizedNativeCalls;
    /**
     * Calculates the delta for the token as defined as the balance - minBalance
     * @param token the token to us
     * @returns
     */
    calculateDelta(token: TokenFetchAnalysis): NormalizedToken;
    /**
     * Returns the normalized min balance for the token. Assumes that the minBalance is
     * set with a decimal of 0, ie in normal dollar units
     * @param tokenAnalysis the token to use
     * @returns
     */
    getNormalizedMinBalance(tokenAnalysis: TokenFetchAnalysis): bigint;
    /**
     * Converts and normalizes the token to a standard reserve value for comparisons
     * @param value the value to convert
     * @param token the token to us
     * @returns
     */
    convertNormalize(value: bigint, token: {
        chainID: bigint;
        address: Hex;
        decimals: number;
    }): NormalizedToken;
    /**
     * Deconverts and denormalizes the token form a standard reserve value for comparisons
     * @param value the value to deconvert
     * @param token the token to deconvert
     * @returns
     */
    deconvertNormalize(value: bigint, token: {
        chainID: bigint;
        address: Hex;
        decimals: number;
    }): {
        balance: bigint;
        chainID: bigint;
        address: Hex;
        decimals: number;
    };
    private getRouteDestinationSolverFee;
    /**
     * Returbs the default route destination solver, unless its a ethereum L1 (mainnet or sepolia).
     * In which case it returns that one instead
     *
     * @param route The route of the quote intent
     * @returns
     */
    getAskRouteDestinationSolver(route: QuoteRouteDataInterface): {
        chainID?: number;
        inboxAddress?: string;
        network?: string;
        targets?: Record<string, {
            contractType?: "erc20" | "erc721" | "erc1155";
            selectors?: string[];
            minBalance?: number;
            targetBalance?: number;
        }>;
        fee?: {
            limit?: {
                tokenBase6?: bigint;
                nativeBase18?: bigint;
            };
            algorithm?: "linear" | "quadratic";
            constants?: any;
        };
        averageBlockTime?: number;
        gasOverhead?: number;
    };
}
