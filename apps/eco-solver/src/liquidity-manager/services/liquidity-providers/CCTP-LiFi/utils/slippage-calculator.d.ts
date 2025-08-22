import { CCTPLiFiStrategyContext } from '@eco-solver/liquidity-manager/types/types';
/**
 * Calculates the total slippage for a CCTPLiFi route
 * @param context The route context containing all steps
 * @returns Total slippage percentage (0-1)
 */
export declare function calculateTotalSlippage(context: CCTPLiFiStrategyContext): number;
