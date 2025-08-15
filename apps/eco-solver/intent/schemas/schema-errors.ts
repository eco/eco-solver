/**
 * Error constants used in schema validation to avoid circular dependencies
 */
export const SCHEMA_ERRORS = {
  INTENT_SOURCE_DATA_INVALID_PARAMS: new Error(
    'IntentSource calls or tokens must have non-zero length',
  ),
} as const;