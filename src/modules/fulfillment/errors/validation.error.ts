import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';

/**
 * Typed error for validation failures
 * Includes error classification for retry behavior
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly type: ValidationErrorType = ValidationErrorType.PERMANENT,
    public readonly validationName?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}