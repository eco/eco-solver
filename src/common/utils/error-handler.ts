/**
 * Type-safe error handling utilities
 */

/**
 * Converts unknown error to Error instance
 * Preserves original error if it's already an Error
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
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
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
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
    error instanceof Error &&
    'code' in error &&
    (typeof (error as any).code === 'string' || typeof (error as any).code === 'number')
  );
}

/**
 * Type guard to check if error has a stack property
 */
export function hasErrorStack(error: unknown): error is Error & { stack: string } {
  return error instanceof Error && typeof error.stack === 'string';
}
