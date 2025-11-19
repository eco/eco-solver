/**
 * Generic Polling Utility for E2E Tests
 *
 * Provides reliable polling with exponential backoff to replace hard-coded setTimeout waits.
 * This makes tests faster and more reliable by adapting to actual system response times.
 */

export interface PollOptions {
  /**
   * Maximum time to wait in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Initial interval between polls in milliseconds
   * @default 100
   */
  interval?: number;

  /**
   * Multiplier for exponential backoff
   * Set to 1 for constant interval
   * @default 1.5 (50% increase each attempt)
   */
  intervalMultiplier?: number;

  /**
   * Maximum interval between polls (prevents exponential growth from getting too large)
   * @default 2000 (2 seconds)
   */
  maxInterval?: number;

  /**
   * Custom error message when timeout occurs
   */
  timeoutMessage?: string;
}

export interface PollResult<T> {
  success: boolean;
  result?: T;
  attempts: number;
  elapsedMs: number;
}

/**
 * Poll a function until a predicate returns true or timeout occurs
 *
 * Features:
 * - Exponential backoff to reduce load
 * - Clear timeout error messages
 * - Returns timing information for debugging
 *
 * @example
 * // Wait for intent to be fulfilled
 * await pollUntil(
 *   () => intentsService.findOne(intentHash),
 *   (intent) => intent?.status === IntentStatus.FULFILLED,
 *   { timeout: 30000, timeoutMessage: `Intent ${intentHash} not fulfilled` }
 * );
 *
 * @example
 * // Wait for balance to increase with exponential backoff
 * await pollUntil(
 *   () => getBalance(address),
 *   (balance) => balance > initialBalance,
 *   { interval: 100, intervalMultiplier: 2, maxInterval: 1000 }
 * );
 *
 * @param fn - Async function to poll
 * @param predicate - Function that returns true when condition is met
 * @param options - Polling configuration options
 * @returns The result from fn when predicate returns true
 * @throws Error when timeout occurs
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  options: PollOptions = {},
): Promise<T> {
  const {
    timeout = 30000,
    interval = 100,
    intervalMultiplier = 1.5,
    maxInterval = 2000,
    timeoutMessage,
  } = options;

  const startTime = Date.now();
  let currentInterval = interval;
  let attempts = 0;

  while (true) {
    attempts++;

    try {
      const result = await fn();

      if (predicate(result)) {
        const elapsedMs = Date.now() - startTime;
        console.log(
          `  ✓ Condition met after ${attempts} attempts (${elapsedMs}ms, avg ${Math.round(elapsedMs / attempts)}ms/attempt)`,
        );
        return result;
      }
    } catch (error) {
      // Log error but continue polling - some operations may fail transiently
      console.log(`  ⚠ Attempt ${attempts} threw error (continuing): ${error}`);
    }

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeout) {
      const message =
        timeoutMessage || `Timeout after ${attempts} attempts (${elapsed}ms) - condition not met`;
      throw new Error(message);
    }

    // Wait before next poll with exponential backoff
    await new Promise((resolve) => setTimeout(resolve, currentInterval));

    // Increase interval for next attempt (exponential backoff)
    currentInterval = Math.min(currentInterval * intervalMultiplier, maxInterval);
  }
}

/**
 * Poll until a condition is true (simplified version without returning value)
 *
 * @example
 * // Wait for a condition to become true
 * await pollUntilTrue(
 *   async () => (await getStatus()) === 'ready',
 *   { timeout: 10000 }
 * );
 */
export async function pollUntilTrue(
  condition: () => Promise<boolean>,
  options: PollOptions = {},
): Promise<void> {
  await pollUntil(condition, (result) => result === true, options);
}

/**
 * Poll until a value changes from its initial value
 *
 * Useful for waiting for state changes, database updates, etc.
 *
 * @example
 * // Wait for balance to change
 * const newBalance = await pollUntilChanged(
 *   () => getBalance(address),
 *   initialBalance
 * );
 */
export async function pollUntilChanged<T>(
  fn: () => Promise<T>,
  initialValue: T,
  options: PollOptions = {},
): Promise<T> {
  return pollUntil(fn, (result) => result !== initialValue, options);
}

/**
 * Poll until a value is defined (not null or undefined)
 *
 * @example
 * // Wait for intent to exist in database
 * const intent = await pollUntilDefined(
 *   () => intentsService.findOne(intentHash)
 * );
 */
export async function pollUntilDefined<T>(
  fn: () => Promise<T | null | undefined>,
  options: PollOptions = {},
): Promise<T> {
  const result = await pollUntil(
    fn,
    (result): result is T => result !== null && result !== undefined,
    options,
  );
  return result as T;
}

/**
 * Create a polling function with default options
 *
 * Useful for creating domain-specific polling functions with consistent configuration.
 *
 * @example
 * // Create a database polling function with custom defaults
 * const pollDatabase = createPoller({
 *   interval: 50,
 *   timeout: 10000,
 *   timeoutMessage: 'Database operation timed out'
 * });
 *
 * // Use it
 * const intent = await pollDatabase(
 *   () => intentsService.findOne(hash),
 *   (intent) => intent !== null
 * );
 */
export function createPoller(defaultOptions: PollOptions) {
  return async function <T>(
    fn: () => Promise<T>,
    predicate: (result: T) => boolean,
    options?: PollOptions,
  ): Promise<T> {
    return pollUntil(fn, predicate, { ...defaultOptions, ...options });
  };
}
