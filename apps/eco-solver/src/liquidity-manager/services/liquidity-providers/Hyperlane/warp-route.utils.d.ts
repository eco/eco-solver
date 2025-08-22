import { Logger } from '@nestjs/common';
export interface RetryConfig {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: any) => boolean;
}
export declare function withRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>, logger?: Logger, context?: Record<string, any>): Promise<T>;
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T>;
