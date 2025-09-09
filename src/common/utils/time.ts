export const delay = (ms: number, i: number = 0) =>
  new Promise((res) => setTimeout(res, ms * Math.pow(2, i)))

/**
 * Creates a Date object representing a time in the past based on minutes ago.
 * Commonly used for database queries with time-based filtering.
 *
 * @param minutes - Number of minutes in the past
 * @returns Date object representing the specified time ago
 */
export const getTimeAgo = (minutes: number): Date => {
  return new Date(Date.now() - minutes * 60 * 1000)
}

/**
 * Creates a Date object representing exactly one hour ago.
 * Convenience function for the common case of hourly health checks.
 *
 * @returns Date object representing one hour ago
 */
export const getOneHourAgo = (): Date => {
  return getTimeAgo(60)
}
