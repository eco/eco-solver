import { isError, isString } from 'es-toolkit';

/**
 * Type-safe error handling utilities
 */

/**
 * Converts unknown error to Error instance
 * Preserves original error if it's already an Error
 */
export function toError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  if (isString(error)) {
    return new Error(error);
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new Error(String((error as { message: unknown }).message));
  }
  return new Error(String(error));
}

/**
 * Gets error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (isString(error)) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Type guard to check if error has a code property
 */
export function hasErrorCode(error: unknown): error is Error & { code: string | number } {
  return (
    isError(error) &&
    'code' in error &&
    (typeof (error as any).code === 'string' || typeof (error as any).code === 'number')
  );
}

/**
 * Type guard to check if error has a stack property
 */
export function hasErrorStack(error: unknown): error is Error & { stack: string } {
  return isError(error) && typeof error.stack === 'string';
}
