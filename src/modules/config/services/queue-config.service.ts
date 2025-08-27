import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { QueueSchema } from '@/config/config.schema';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';

type QueueConfig = z.infer<typeof QueueSchema>;

@Injectable()
export class QueueConfigService {
  constructor(private configService: ConfigService) {}

  get defaultJobOptions() {
    return {
      attempts: this.configService.get<number>('queue.attempts'),
      backoff: {
        type: this.configService.get<string>('queue.backoffType'),
        delay: this.configService.get<number>('queue.backoffDelay'),
      },
    };
  }

  get concurrency(): QueueConfig['concurrency'] {
    return this.configService.get<number>('queue.concurrency');
  }

  get executionConcurrency(): QueueConfig['executionConcurrency'] {
    return this.configService.get<number>('queue.executionConcurrency');
  }

  get maxRetriesPerRequest(): QueueConfig['maxRetriesPerRequest'] {
    return this.configService.get<number>('queue.maxRetriesPerRequest');
  }

  get retryDelayMs(): QueueConfig['retryDelayMs'] {
    return this.configService.get<number>('queue.retryDelayMs');
  }

  /**
   * Get retry configuration for a specific error type
   */
  getRetryOptions(errorType: ValidationErrorType) {
    switch (errorType) {
      case ValidationErrorType.PERMANENT:
        return { attempts: 1 }; // No retry for permanent errors

      case ValidationErrorType.TEMPORARY:
        return {
          attempts: this.configService.get<number>('queue.retry.temporary.attempts', 5),
          backoff: {
            type: 'exponential' as const,
            delay: this.configService.get<number>('queue.retry.temporary.backoffMs', 5000),
          },
        };

      default:
        return { attempts: 1 }; // Default to no retry
    }
  }

  /**
   * Get retry configuration for temporary errors specifically
   */
  get temporaryRetryConfig() {
    return {
      attempts: this.configService.get<number>('queue.retry.temporary.attempts', 5),
      backoffMs: this.configService.get<number>('queue.retry.temporary.backoffMs', 5000),
    };
  }
}
