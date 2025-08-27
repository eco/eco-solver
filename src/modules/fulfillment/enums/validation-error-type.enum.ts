/**
 * Validation error types for intent fulfillment
 * Used to determine retry behavior for failed validations
 */
export enum ValidationErrorType {
  /**
   * Permanent errors that should never be retried
   * Examples: invalid chain ID, expired deadline, insufficient balance
   */
  PERMANENT = 'permanent',

  /**
   * Temporary errors that should be retried with backoff
   * Examples: intent not yet funded on-chain, temporary network issues
   */
  TEMPORARY = 'temporary',
}