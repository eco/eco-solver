import { Observable, timer } from 'rxjs';
import { mergeMap, retryWhen, scan, tap } from 'rxjs/operators';

import { getErrorMessage, toError } from '@/common/utils/error-handler';

export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * RxJS operator for exponential backoff retry logic
 * @param config - Retry configuration
 * @returns RxJS operator that implements retry with exponential backoff
 */
export function retryWithBackoff<T>(config: RetryConfig = {}) {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  return (source: Observable<T>) =>
    source.pipe(
      retryWhen((errors) =>
        errors.pipe(
          scan((acc, error) => {
            const attempt = acc + 1;
            const err = toError(error);

            // Check if we should retry
            if (attempt > finalConfig.maxAttempts) {
              throw new Error(
                `Max retry attempts (${finalConfig.maxAttempts}) exceeded. Last error: ${getErrorMessage(err)}`,
              );
            }

            if (!finalConfig.shouldRetry(err, attempt)) {
              throw err;
            }

            return attempt;
          }, 0),
          tap((attempt) => {
            const error = toError(errors);
            finalConfig.onRetry(error, attempt);
          }),
          mergeMap((attempt) => {
            const delay = Math.min(
              finalConfig.initialDelay * Math.pow(finalConfig.backoffFactor, attempt - 1),
              finalConfig.maxDelay,
            );
            return timer(delay);
          }),
        ),
      ),
    );
}

/**
 * Configuration for polling operations
 */
export interface PollingConfig extends RetryConfig {
  pollInterval: number;
  immediate?: boolean; // Whether to execute immediately or wait for first interval
}

/**
 * Creates an Observable that polls at regular intervals with retry logic
 * @param operation - Function to execute on each poll
 * @param config - Polling configuration
 * @returns Observable that emits results from the polling operation
 */
export function pollWithRetry<T>(
  operation: () => Observable<T> | Promise<T>,
  config: PollingConfig,
): Observable<T> {
  const { pollInterval, immediate = true, ...retryConfig } = config;

  // Create the base observable from the operation
  const createOperation = () => {
    const result = operation();
    return result instanceof Promise
      ? new Observable<T>((subscriber) => {
          result
            .then((value) => {
              subscriber.next(value);
              subscriber.complete();
            })
            .catch((error) => subscriber.error(error));
        })
      : result;
  };

  // Create polling observable
  return new Observable<T>((subscriber) => {
    let isActive = true;

    const executePoll = () => {
      if (!isActive) return;

      createOperation()
        .pipe(retryWithBackoff(retryConfig))
        .subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => {
            // Log error but continue polling
            console.error('Poll operation failed after retries:', getErrorMessage(error));
            // Schedule next poll even after error
            if (isActive) {
              setTimeout(executePoll, pollInterval);
            }
          },
          complete: () => {
            // Schedule next poll
            if (isActive) {
              setTimeout(executePoll, pollInterval);
            }
          },
        });
    };

    // Start polling
    if (immediate) {
      executePoll();
    } else {
      setTimeout(executePoll, pollInterval);
    }

    // Cleanup function
    return () => {
      isActive = false;
    };
  });
}

/**
 * Convert a Promise-based function to use RxJS retry logic
 * @param fn - Async function to wrap
 * @param config - Retry configuration
 * @returns Function that returns an Observable with retry logic
 */
export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  config: RetryConfig = {},
): (...args: T) => Observable<R> {
  return (...args: T) => {
    return new Observable<R>((subscriber) => {
      fn(...args)
        .then((value) => {
          subscriber.next(value);
          subscriber.complete();
        })
        .catch((error) => subscriber.error(error));
    }).pipe(retryWithBackoff(config));
  };
}

/**
 * Execute a Promise-based function with retry logic and return a Promise
 * @param fn - Function to execute
 * @param config - Retry configuration
 * @returns Promise that resolves with the function result
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    withRetry(fn, config)().subscribe({
      next: (value) => resolve(value),
      error: (error) => reject(error),
    });
  });
}
