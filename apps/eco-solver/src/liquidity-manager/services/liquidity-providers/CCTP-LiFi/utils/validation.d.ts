import { TokenData } from '@eco-solver/liquidity-manager/types/types';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}
export interface GasEstimation {
    sourceChainGas: bigint;
    destinationChainGas: bigint;
    totalGasUSD: number;
    gasWarnings: string[];
}
export declare class CCTPLiFiValidator {
    /**
     * Validates a CCTPLiFi route before execution
     * @param tokenIn Source token
     * @param tokenOut Destination token
     * @param swapAmount Amount to swap
     * @param maxSlippage Maximum acceptable slippage (0-1)
     * @returns Validation result with errors if any
     */
    static validateRoute(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number, maxSlippage: number): ValidationResult;
    /**
     * Estimates gas costs for a CCTPLiFi route
     * @param sourceChainId Source chain ID
     * @param destinationChainId Destination chain ID
     * @param hasSourceSwap Whether route includes source swap
     * @param hasDestinationSwap Whether route includes destination swap
     * @returns Gas estimation details
     */
    static estimateGasCosts(sourceChainId: number, destinationChainId: number, hasSourceSwap: boolean, hasDestinationSwap: boolean): GasEstimation;
    /**
     * Estimates gas cost in USD for a given chain and gas amount
     */
    private static estimateGasUSD;
}
