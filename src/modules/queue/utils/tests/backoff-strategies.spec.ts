import { QueueConfigService } from '@/modules/config/services/queue-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';

import { createExponentialCappedStrategy } from '../backoff-strategies';

describe('Backoff Strategies', () => {
  let mockQueueConfig: jest.Mocked<QueueConfigService>;
  let mockLogger: jest.Mocked<SystemLoggerService>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      setContext: jest.fn(),
    } as any;

    mockQueueConfig = {
      executionBackoffConfig: {
        backoffDelay: 1000,
        backoffMaxDelay: 10000,
        backoffJitter: 0,
        useCustomBackoff: true,
      },
    } as any;
  });

  describe('createExponentialCappedStrategy', () => {
    it('should calculate exponential backoff delays', () => {
      const strategy = createExponentialCappedStrategy(mockQueueConfig, mockLogger);

      // Test exponential growth: baseDelay * 2^(attempt-1)
      expect(strategy(1, undefined, undefined, undefined)).toBe(1000); // 1000 * 2^0
      expect(strategy(2, undefined, undefined, undefined)).toBe(2000); // 1000 * 2^1
      expect(strategy(3, undefined, undefined, undefined)).toBe(4000); // 1000 * 2^2
      expect(strategy(4, undefined, undefined, undefined)).toBe(8000); // 1000 * 2^3
    });

    it('should apply maximum delay cap', () => {
      const strategy = createExponentialCappedStrategy(mockQueueConfig, mockLogger);

      // Test that delays are capped at maxDelay (10000ms)
      expect(strategy(5, undefined, undefined, undefined)).toBe(10000); // Would be 16000, capped at 10000
      expect(strategy(6, undefined, undefined, undefined)).toBe(10000); // Would be 32000, capped at 10000
      expect(strategy(10, undefined, undefined, undefined)).toBe(10000); // Would be very large, capped at 10000
    });

    it('should apply jitter to delays', () => {
      const jitterQueueConfig = {
        executionBackoffConfig: {
          backoffDelay: 1000,
          backoffMaxDelay: 10000,
          backoffJitter: 0.5, // 50% jitter
          useCustomBackoff: true,
        },
      } as any;

      const strategy = createExponentialCappedStrategy(jitterQueueConfig, mockLogger);

      // With jitter=0.5, delays should be between 50% and 100% of calculated delay
      const delay1 = strategy(1, undefined, undefined, undefined);
      expect(delay1).toBeGreaterThanOrEqual(500); // 1000 * 0.5
      expect(delay1).toBeLessThanOrEqual(1000); // 1000 * 1.0

      const delay2 = strategy(2, undefined, undefined, undefined);
      expect(delay2).toBeGreaterThanOrEqual(1000); // 2000 * 0.5
      expect(delay2).toBeLessThanOrEqual(2000); // 2000 * 1.0
    });

    it('should apply jitter to capped delays', () => {
      const cappedJitterConfig = {
        executionBackoffConfig: {
          backoffDelay: 1000,
          backoffMaxDelay: 5000,
          backoffJitter: 0.5,
          useCustomBackoff: true,
        },
      } as any;

      const strategy = createExponentialCappedStrategy(cappedJitterConfig, mockLogger);

      // Attempt 5 would be 16000ms, capped at 5000ms, then jittered
      const delay = strategy(5, undefined, undefined, undefined);
      expect(delay).toBeGreaterThanOrEqual(2500); // 5000 * 0.5
      expect(delay).toBeLessThanOrEqual(5000); // 5000 * 1.0
    });

    it('should log debug information', () => {
      const strategy = createExponentialCappedStrategy(mockQueueConfig, mockLogger);

      strategy(3, undefined, undefined, undefined);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ExponentialCapped backoff for attempt 3'),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('exponential=4000ms'));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('capped=4000ms'));
    });

    it('should handle zero jitter', () => {
      const zeroJitterConfig = {
        executionBackoffConfig: {
          backoffDelay: 1000,
          backoffMaxDelay: 10000,
          backoffJitter: 0, // No jitter
          useCustomBackoff: true,
        },
      } as any;

      const strategy = createExponentialCappedStrategy(zeroJitterConfig, mockLogger);

      // With zero jitter, delays should be exact exponential values
      expect(strategy(1, undefined, undefined, undefined)).toBe(1000);
      expect(strategy(2, undefined, undefined, undefined)).toBe(2000);
      expect(strategy(3, undefined, undefined, undefined)).toBe(4000);
    });

    it('should handle first attempt correctly', () => {
      const strategy = createExponentialCappedStrategy(mockQueueConfig, mockLogger);

      // First retry (attempt 1) should use base delay: 1000 * 2^0 = 1000
      expect(strategy(1, undefined, undefined, undefined)).toBe(1000);
    });

    it('should work with different base delays', () => {
      const customDelayConfig = {
        executionBackoffConfig: {
          backoffDelay: 5000,
          backoffMaxDelay: 300000,
          backoffJitter: 0,
          useCustomBackoff: true,
        },
      } as any;

      const strategy = createExponentialCappedStrategy(customDelayConfig, mockLogger);

      expect(strategy(1, undefined, undefined, undefined)).toBe(5000); // 5000 * 2^0
      expect(strategy(2, undefined, undefined, undefined)).toBe(10000); // 5000 * 2^1
      expect(strategy(3, undefined, undefined, undefined)).toBe(20000); // 5000 * 2^2
    });
  });
});
