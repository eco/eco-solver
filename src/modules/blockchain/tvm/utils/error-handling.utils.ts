import * as api from '@opentelemetry/api';

import { SystemLoggerService } from '@/modules/logging';

import { TvmError, TvmTransactionError } from '../errors';

/**
 * Standard error context for TVM operations
 */
export interface TvmErrorContext {
  operation: string;
  chainId?: string | number;
  address?: string;
  transactionId?: string;
  [key: string]: any;
}

/**
 * Utility class for standardized error handling in TVM module
 */
export class TvmErrorHandler {
  /**
   * Handles errors in a standardized way with proper logging and span recording
   * @param error - The error that occurred
   * @param context - Context information about the operation
   * @param span - OpenTelemetry span (optional)
   * @param logger - Logger instance (optional)
   * @throws The original error after logging and recording
   */
  static handleError(
    error: unknown,
    context: TvmErrorContext,
    span?: api.Span,
    logger?: SystemLoggerService,
  ): never {
    // Log the error with context
    if (logger) {
      logger.error(
        `TVM ${context.operation} error:`,
        error instanceof Error ? error.message : String(error),
        context,
      );
    }

    // Record exception in span if provided
    if (span) {
      span.recordException(error as Error);
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Re-throw the error
    throw error;
  }

  /**
   * Wraps an async operation with standardized error handling
   * @param operation - The async operation to execute
   * @param context - Context information about the operation
   * @param span - OpenTelemetry span (optional)
   * @param logger - Logger instance (optional)
   * @returns The result of the operation
   * @throws Any error from the operation after logging
   */
  static async wrapAsync<T>(
    operation: () => Promise<T>,
    context: TvmErrorContext,
    span?: api.Span,
    logger?: SystemLoggerService,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, context, span, logger);
    }
  }

  /**
   * Determines if an error is a TVM-specific error
   * @param error - The error to check
   * @returns True if the error is a TVM error
   */
  static isTvmError(error: unknown): error is TvmError {
    return error instanceof TvmError;
  }

  /**
   * Determines if an error is a transaction error
   * @param error - The error to check
   * @returns True if the error is a transaction error
   */
  static isTransactionError(error: unknown): error is TvmTransactionError {
    return error instanceof TvmTransactionError;
  }

  /**
   * Creates a standardized error message with context
   * @param message - The base error message
   * @param context - Context information
   * @returns Formatted error message
   */
  static formatErrorMessage(message: string, context: TvmErrorContext): string {
    const contextParts: string[] = [`operation=${context.operation}`];

    if (context.chainId) contextParts.push(`chainId=${context.chainId}`);
    if (context.address) contextParts.push(`address=${context.address}`);
    if (context.transactionId) contextParts.push(`txId=${context.transactionId}`);

    return `${message} [${contextParts.join(', ')}]`;
  }
}
