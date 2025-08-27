import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';

import { ValidationError } from './validation.error';

/**
 * Aggregated error for multiple validation failures
 * Preserves individual error types and determines overall retry behavior
 * PERMANENT errors take precedence - if ANY error is PERMANENT, no retry occurs
 */
export class AggregatedValidationError extends ValidationError {
  public readonly individualErrors: Error[];

  constructor(errors: Error[]) {
    const errorMessages = errors.map((error) => error.message).join('; ');
    const aggregatedType = AggregatedValidationError.determineAggregatedType(errors);
    
    super(`Validation failures: ${errorMessages}`, aggregatedType, 'Multiple');
    
    this.name = 'AggregatedValidationError';
    this.individualErrors = errors;
  }

  /**
   * Determines the aggregated error type from multiple errors
   * PERMANENT takes precedence - if ANY error is PERMANENT, return PERMANENT
   * Only returns TEMPORARY if ALL errors are TEMPORARY
   */
  private static determineAggregatedType(errors: Error[]): ValidationErrorType {
    // Check if any error is PERMANENT
    const hasPermanentError = errors.some((error) => {
      if (error instanceof ValidationError) {
        return error.type === ValidationErrorType.PERMANENT;
      }
      // Non-ValidationError errors are treated as PERMANENT
      return true;
    });

    if (hasPermanentError) {
      return ValidationErrorType.PERMANENT;
    }

    // Check if all errors are TEMPORARY ValidationErrors
    const allTemporary = errors.every((error) => {
      return error instanceof ValidationError && error.type === ValidationErrorType.TEMPORARY;
    });

    // Only return TEMPORARY if ALL errors are explicitly TEMPORARY
    return allTemporary ? ValidationErrorType.TEMPORARY : ValidationErrorType.PERMANENT;
  }

  /**
   * Get individual validation errors that failed
   */
  getValidationErrors(): ValidationError[] {
    return this.individualErrors.filter((error) => error instanceof ValidationError) as ValidationError[];
  }

  /**
   * Check if this aggregated error contains any PERMANENT errors
   */
  hasPermanentError(): boolean {
    return this.type === ValidationErrorType.PERMANENT;
  }

  /**
   * Check if all errors are TEMPORARY (can be retried)
   */
  isFullyRetryable(): boolean {
    return this.type === ValidationErrorType.TEMPORARY;
  }
}