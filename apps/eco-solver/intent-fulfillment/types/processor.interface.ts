import { Queue } from 'bullmq'
import { Logger } from '@nestjs/common'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'

/**
 * Interface for the Intent Fulfillment Processor to break circular dependencies
 * This allows job managers to type their processor parameter without importing the concrete class
 */
export interface IntentFulfillmentProcessorInterface {
  readonly queue: Queue
  readonly fulfillIntentService: FulfillIntentService
  readonly logger: Logger
}