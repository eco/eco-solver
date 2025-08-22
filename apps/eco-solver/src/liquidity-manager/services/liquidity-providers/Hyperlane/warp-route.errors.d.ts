export declare class WarpRouteError extends Error {
    readonly context?: Record<string, any>;
    constructor(message: string, context?: Record<string, any>);
}
export declare class WarpRouteNotFoundError extends WarpRouteError {
    constructor(chainId: number, tokenAddress: string);
}
export declare class UnsupportedActionPathError extends WarpRouteError {
    constructor(tokenIn: {
        address: string;
        chainId: number;
    }, tokenOut: {
        address: string;
        chainId: number;
    });
}
export declare class UnsupportedWalletError extends WarpRouteError {
    constructor(walletAddress: string);
}
export declare class MessageDispatchError extends WarpRouteError {
    constructor(transactionHash: string);
}
export declare class PartialQuoteError extends WarpRouteError {
    constructor(reason: string, context?: Record<string, any>);
}
export declare class InvalidInputError extends WarpRouteError {
    constructor(message: string, context?: Record<string, any>);
}
