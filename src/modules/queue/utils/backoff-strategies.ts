import { BackoffStrategy } from 'bullmq';

import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';

/**
 * Creates an exponential backoff strategy with a maximum delay cap and jitter.
 *
 * This strategy implements exponential backoff where each retry doubles the delay,
 * with a configurable maximum cap to prevent excessive wait times. Jitter is applied
 * to prevent thundering herd issues when multiple jobs fail simultaneously.
 *
 * @param queueConfig - Queue configuration service providing backoff parameters
 * @param logger - Logger service for debugging backoff calculations
 * @returns BackoffStrategy function compatible with BullMQ worker settings
 *
 * @example
 * const backoffStrategy = createExponentialCappedStrategy(queueConfig, logger);
 * // With defaults (2000ms base, 300000ms cap, 0.5 jitter):
 * // Attempt 1: 1000-2000ms
 * // Attempt 2: 2000-4000ms
 * // Attempt 3: 4000-8000ms
 * // ...continues until cap is reached
 */
export const createExponentialCappedStrategy = (
  queueConfig: QueueConfigService,
  logger: SystemLoggerService,
): BackoffStrategy => {
  return (attemptsMade, _type, _err, _job) => {
    const backoffConfig = queueConfig.executionBackoffConfig;
    const { backoffDelay, backoffMaxDelay, backoffJitter } = backoffConfig;

    // Calculate exponential delay: baseDelay * (2 ^ (attempt - 1))
    const exponentialDelay = backoffDelay * Math.pow(2, attemptsMade - 1);

    // Apply cap to limit maximum delay
    const cappedDelay = Math.min(exponentialDelay, backoffMaxDelay);

    // Apply jitter to prevent thundering herd
    // Jitter factor of 0.5 means delay will be between 50% and 100% of calculated delay
    const jitterFactor = 1 - Math.random() * backoffJitter;
    const finalDelay = Math.round(cappedDelay * jitterFactor);

    logger.debug(
      `ExponentialCapped backoff for attempt ${attemptsMade}: exponential=${exponentialDelay}ms, ` +
        `capped=${cappedDelay}ms, final=${finalDelay}ms (jitter=${backoffJitter})`,
    );

    return finalDelay;
  };
};
