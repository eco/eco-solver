/**
 * Utility functions for the analytics module
 */

/**
 * Get the current environment from NODE_ENV with fallback to development
 *
 * @returns The current environment (development, staging, preproduction, production, test)
 *
 * @example
 * const env = getCurrentEnvironment()
 * // Returns: 'development', 'production', 'staging', etc.
 */
export function getCurrentEnvironment(): string {
  return process.env.NODE_ENV || 'development'
}
