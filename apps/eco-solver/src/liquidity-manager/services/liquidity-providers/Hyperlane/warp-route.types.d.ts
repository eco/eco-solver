import { Hex } from 'viem';
export declare enum ActionPath {
    FULL = "FULL",
    PARTIAL = "PARTIAL",
    UNSUPPORTED = "UNSUPPORTED"
}
export interface WarpToken {
    chainId: number;
    token: Hex;
    type: 'collateral' | 'synthetic';
    warpContract: Hex;
}
export interface WarpRoute {
    chains: WarpToken[];
}
export interface WarpRouteResult {
    warpRoute: WarpRoute | undefined;
    warpToken: WarpToken | undefined;
}
export interface PartialQuotePath {
    type: 'SYNTHETIC_TO_COLLATERAL' | 'COLLATERAL_TO_SYNTHETIC' | 'TOKEN_TO_SYNTHETIC' | 'TOKEN_TO_COLLATERAL';
    description: string;
}
export declare const PARTIAL_QUOTE_PATHS: {
    readonly SYNTHETIC_TO_COLLATERAL: "Synthetic -> Collateral -> TokenOut";
    readonly COLLATERAL_TO_SYNTHETIC: "Collateral -> Synthetic -> TokenOut";
    readonly TOKEN_TO_SYNTHETIC: "TokenIn -> Collateral -> Synthetic";
    readonly TOKEN_TO_COLLATERAL: "TokenIn -> Synthetic -> Collateral";
};
export interface MessageRelayConfig {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
}
