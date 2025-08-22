import { EcoError } from '@eco-solver/common/errors/eco-error';
import { FeeAlgorithm } from '@libs/solver-config';
import { ValidationChecks } from '@eco-solver/intent/validation.sevice';
import { Hex } from 'viem';
import { NormalizedTotal } from '@eco-solver/fee/types';
/**
 * Errors that can be thrown by the quote service
 */
export interface QuoteErrorsInterface {
    statusCode: number;
    message: string;
    code: number;
    [key: string]: any;
}
export type Quote400 = QuoteErrorsInterface & {
    statusCode: 400;
};
export type Quote500 = QuoteErrorsInterface & {
    statusCode: 500;
};
export declare const ProverUnsupported: Quote400;
export declare const RewardInvalid: Quote400;
export declare const CallsUnsupported: Quote400;
export declare const SolverUnsupported: Quote400;
export declare function InvalidQuoteIntent(validations: ValidationChecks): Quote400;
/**
 * The quote intent cannot be fulfilled because it doesn't have a
 * reward hight enough to cover the ask
 *
 * @param totalAsk the total amount of the ask
 * @param totalFulfillment
 * @returns
 */
export declare function InsufficientBalance(totalAsk: NormalizedTotal, totalFulfillment: NormalizedTotal): Quote400;
export declare function InfeasibleQuote(error: Error): Quote400;
export declare function InvalidQuote(results: (false | {
    solvent: boolean;
    profitable: boolean;
} | undefined)[]): Quote400;
export declare function InsolventUnprofitableQuote(results: (false | {
    solvent: boolean;
    profitable: boolean;
} | undefined)[]): Quote400;
/**
 * The server failed to save to db
 * @param error  the error that was thrown
 * @returns
 */
export declare function InternalSaveError(error: Error): Quote500;
/**
 * The server failed to generate the quote
 * @returns
 */
export declare function InternalQuoteError(error?: Error): Quote500;
export declare class QuoteError extends Error {
    static InvalidSolverAlgorithm(destination: bigint, algorithm: FeeAlgorithm): EcoError;
    static NoSolverForDestination(destination: bigint): EcoError;
    static NoIntentSourceForSource(source: bigint): EcoError;
    static NoIntentSourceForDestination(destination: bigint): EcoError;
    static FetchingRewardTokensFailed(chainID: bigint): EcoError;
    static FetchingCallTokensFailed(chainID: bigint): EcoError;
    static NonERC20TargetInCalls(): EcoError;
    static SolverLacksLiquidity(chainID: number, target: Hex, requested: bigint, available: bigint, normMinBalance: bigint): EcoError;
    static RouteIsInfeasable(ask: NormalizedTotal, reward: NormalizedTotal): EcoError;
    static RewardIsInfeasable(fee: NormalizedTotal, reward: NormalizedTotal): EcoError;
    static MultiFulfillRoute(): EcoError;
    static DuplicatedRewardToken(): EcoError;
    static FailedToFetchTarget(chainID: bigint, target: Hex): EcoError;
    static RewardTokenNotFound(address: Hex): EcoError;
    static RouteTokenNotFound(address: Hex): EcoError;
    static InvalidFunctionData(target: Hex): EcoError;
}
