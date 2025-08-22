import { TokenData } from '@eco-solver/liquidity-manager/types/types';
import { Hex } from 'viem';
export interface RouteStep {
    type: 'sourceSwap' | 'cctpBridge' | 'destinationSwap';
    required: boolean;
}
export declare class CCTPLiFiRoutePlanner {
    private static DEFAULT_USDC_ADDRESSES;
    private static USDC_ADDRESSES;
    /**
     * Updates the USDC addresses from config
     * @param usdcAddresses Map of chain ID to USDC address
     */
    static updateUSDCAddresses(usdcAddresses: Record<number, Hex>): void;
    /**
     * Gets the current USDC addresses (for testing or verification)
     * @returns Current USDC address configuration
     */
    static getUSDCAddresses(): Record<number, Hex>;
    /**
     * Resets to default addresses (mainly for testing)
     */
    static resetToDefaults(): void;
    /**
     * Plans the route steps needed for a CCTPLiFi operation
     * @param tokenIn Source token
     * @param tokenOut Destination token
     * @returns Array of required route steps
     */
    static planRoute(tokenIn: TokenData, tokenOut: TokenData): RouteStep[];
    /**
     * Determines if a token is USDC on its respective chain
     * @param token Token to check
     * @returns True if token is USDC
     */
    static isUSDC(token: TokenData): boolean;
    /**
     * Gets the USDC address for a given chain
     * @param chainId Chain ID
     * @returns USDC address for the chain
     */
    static getUSDCAddress(chainId: number): Hex;
    /**
     * Validates that both chains support CCTP
     * @param sourceChainId Source chain ID
     * @param destinationChainId Destination chain ID
     * @returns True if both chains support CCTP
     */
    static validateCCTPSupport(sourceChainId: number, destinationChainId: number): boolean;
}
