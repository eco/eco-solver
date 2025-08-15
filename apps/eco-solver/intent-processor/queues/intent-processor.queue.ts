import { initBullMQ } from '@/bullmq/bullmq.helper'
import { IntentProcessorJobName } from '@/intent-processor/constants/job-names'
import {
  IntentProcessorQueueType,
  IntentProcessorQueueDataType,
} from '@/intent-processor/types/queue.types'

// Re-export types and enums for backward compatibility
export { IntentProcessorJobName, IntentProcessorQueueType }

export class IntentProcessorQueue {
  public static readonly prefix = '{intent-processor}'
  public static readonly queueName = IntentProcessorQueue.name

  constructor(private readonly queue: IntentProcessorQueueType) {}

  get name() {
    return this.queue.name
  }

  static init() {
    return initBullMQ(
      { queue: this.queueName, prefix: IntentProcessorQueue.prefix },
      {
        defaultJobOptions: {
          removeOnFail: true,
          removeOnComplete: true,
        },
      },
    )
  }

  // Job creation methods moved to IntentProcessorJobFactory to break circular dependencies
}
