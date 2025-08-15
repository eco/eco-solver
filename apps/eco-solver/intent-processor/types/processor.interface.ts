import { Logger } from '@nestjs/common'

/**
 * Interface for the Intent Processor to break circular dependencies
 * This allows job managers to type their processor parameter without importing the concrete class
 */
export interface IntentProcessorInterface {
  readonly logger: Logger
  readonly intentProcessorService: {
    executeSendBatch(data: any): Promise<void>
    executeWithdrawals(data: any): Promise<void>
    getNextSendBatch(): Promise<void>
    getNextBatchWithdrawals(): Promise<void>
  }
}