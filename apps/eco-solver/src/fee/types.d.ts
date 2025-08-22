import { TokenFetchAnalysis } from '@eco-solver/balance/balance.service';
import { RewardTokensInterface } from '@eco-solver/contracts';
import { Solver } from '@libs/solver-config';
import { Prettify } from 'viem';
import { Hex } from 'viem';
/**
 * The response quote data
 */
export interface QuoteData {
    tokens: RewardTokensInterface[];
    expiryTime: string;
}
/**
 * The normalized tokens for the quote intent
 */
export interface NormalizedTokens {
    rewardTokens: RewardTokensInterface[];
    callTokens: RewardTokensInterface[];
}
/**
 * The normalized call type
 */
export type NormalizedCall = NormalizedToken & {
    recipient: Hex;
    native: {
        amount: bigint;
    };
};
/**
 * The normalized token type
 */
export type NormalizedToken = {
    balance: bigint;
    chainID: bigint;
    address: Hex;
    decimals: number;
};
/**
 * The type fo rthe normalized sum of tokens an native gas for a call
 */
export type NormalizedTotal = {
    token: bigint;
    native: bigint;
};
/**
 * The type for the token fetch analysis with the normalized delta
 */
export type DeficitDescending = Prettify<TokenFetchAnalysis & {
    delta: NormalizedToken;
}>;
/**
 * The type for the calculated tokens
 */
export type CalculateTokensType = {
    solver: Solver;
    rewards: NormalizedToken[];
    tokens: NormalizedToken[];
    calls: NormalizedCall[];
    srcDeficitDescending: DeficitDescending[];
    destDeficitDescending: DeficitDescending[];
};
