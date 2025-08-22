import { TokenBalance, TokenConfig } from '@eco-solver/balance/types';
import { TokenAnalysis, TokenDataAnalyzed } from '@eco-solver/liquidity-manager/types/types';
/**
 * Analyzes a token's balance against its configuration and returns the analysis.
 * @param tokenConfig - The configuration of the token.
 * @param tokenBalance - The current balance of the token.
 * @param percentage - The percentage thresholds for up and down.
 * @returns The analysis of the token's balance.
 */
export declare function analyzeToken(tokenConfig: TokenConfig, tokenBalance: TokenBalance, percentage: {
    down: number;
    up: number;
    targetSlippage: number;
}): TokenAnalysis;
/**
 * Analyzes a group of tokens and returns the total difference and the items in the group.
 * @param group - The group of analyzed token data.
 * @returns The total difference and the items in the group.
 */
export declare function analyzeTokenGroup(group: TokenDataAnalyzed[]): {
    total: number;
    items: TokenDataAnalyzed[];
};
export declare function getGroupTotal(group: TokenDataAnalyzed[]): number;
export declare function getSortGroupByDiff(group: TokenDataAnalyzed[]): TokenDataAnalyzed[];
