export const ONE_MINUTE = 60;

/**
 * Get current timestamp in seconds
 * @returns Current Unix timestamp in seconds
 */
export const now = () => Math.floor(Date.now() / 1000);

/**
 * Convert minutes to seconds
 * @param minutes - Number of minutes
 * @returns Number of seconds
 */
export const minutes = (minutes: number) => ONE_MINUTE * minutes;

/**
 * Convert hours to seconds
 * @param hours - Number of hours
 * @returns Number of seconds
 */
export const hours = (hours: number) => minutes(60) * hours;
