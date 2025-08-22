export declare class EverclearError extends Error {
    readonly context?: Record<string, any>;
    constructor(message: string, context?: Record<string, any>);
}
export declare class EverclearApiError extends EverclearError {
    readonly status: number;
    readonly errorBody: string;
    constructor(message: string, status: number, errorBody: string, context?: Record<string, any>);
}
