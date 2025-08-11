import { Injectable, Logger } from '@nestjs/common'
import { BatchWithdraws, SendBatchData, EcoLogMessage, EcoError } from '@libs/shared'

export interface BatchProcessingResult<T> {
  processed: T[]
  failed: T[]
  errors: Array<{ item: T; error: Error }>
}

export interface BatchConfig {
  maxRetries: number
  retryDelay: number
  maxConcurrent: number
  timeout: number
}

@Injectable()
export class BatchProcessingService {
  private readonly logger = new Logger(BatchProcessingService.name)

  private readonly defaultConfig: BatchConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    maxConcurrent: 5,
    timeout: 30000
  }

  /**
   * Process batch withdrawals with error handling and retries
   * @param withdrawals Array of withdrawals to process
   * @param processor Function to process each withdrawal
   * @param config Processing configuration
   * @returns Processing results with success/failure counts
   */
  async processBatchWithdrawals<R>(
    withdrawals: BatchWithdraws[],
    processor: (withdrawal: BatchWithdraws) => Promise<R>,
    config: Partial<BatchConfig> = {}
  ): Promise<BatchProcessingResult<BatchWithdraws>> {
    const effectiveConfig = { ...this.defaultConfig, ...config }
    
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'starting batch withdrawal processing',
        properties: { 
          count: withdrawals.length,
          config: effectiveConfig
        }
      })
    )

    return this.processWithRetry(withdrawals, processor, effectiveConfig)
  }

  /**
   * Process send batch data with error handling and retries
   * @param batches Array of batch data to process
   * @param processor Function to process each batch
   * @param config Processing configuration
   * @returns Processing results with success/failure counts
   */
  async processSendBatches<R>(
    batches: SendBatchData[],
    processor: (batch: SendBatchData) => Promise<R>,
    config: Partial<BatchConfig> = {}
  ): Promise<BatchProcessingResult<SendBatchData>> {
    const effectiveConfig = { ...this.defaultConfig, ...config }
    
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'starting send batch processing',
        properties: { 
          count: batches.length,
          config: effectiveConfig
        }
      })
    )

    return this.processWithRetry(batches, processor, effectiveConfig)
  }

  /**
   * Generic batch processing with retry logic
   * @param items Array of items to process
   * @param processor Function to process each item
   * @param config Processing configuration
   * @returns Processing results
   */
  private async processWithRetry<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    config: BatchConfig
  ): Promise<BatchProcessingResult<T>> {
    const result: BatchProcessingResult<T> = {
      processed: [],
      failed: [],
      errors: []
    }

    // Process items in controlled concurrency batches
    const semaphore = new Array(config.maxConcurrent).fill(null)
    let processedCount = 0

    const processItem = async (item: T): Promise<void> => {
      let lastError: Error | null = null
      
      for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Processing timeout')), config.timeout)
          })

          await Promise.race([
            processor(item),
            timeoutPromise
          ])

          result.processed.push(item)
          processedCount++
          
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: 'item processed successfully',
              properties: { 
                attempt,
                processedCount,
                totalItems: items.length
              }
            })
          )
          return
        } catch (error) {
          lastError = EcoError.getErrorObject(error)
          
          this.logger.warn(
            EcoLogMessage.withError({
              message: 'item processing failed, retrying',
              error: lastError,
              properties: { 
                attempt,
                maxRetries: config.maxRetries,
                item: this.sanitizeItemForLogging(item)
              }
            })
          )

          if (attempt < config.maxRetries) {
            await this.delay(config.retryDelay * attempt) // Exponential backoff
          }
        }
      }

      // All retries exhausted
      result.failed.push(item)
      result.errors.push({ item, error: lastError! })
      
      this.logger.error(
        EcoLogMessage.withError({
          message: 'item processing failed after all retries',
          error: lastError!,
          properties: { 
            maxRetries: config.maxRetries,
            item: this.sanitizeItemForLogging(item)
          }
        })
      )
    }

    // Process items with concurrency control
    const chunks = this.chunkArray(items, config.maxConcurrent)
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(processItem))
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'batch processing completed',
        properties: { 
          totalItems: items.length,
          processed: result.processed.length,
          failed: result.failed.length,
          errors: result.errors.length
        }
      })
    )

    return result
  }

  /**
   * Chunk array into smaller arrays of specified size
   * @param array Array to chunk
   * @param chunkSize Size of each chunk
   * @returns Array of chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Delay execution for specified milliseconds
   * @param ms Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Sanitize item data for logging (remove sensitive information)
   * @param item Item to sanitize
   * @returns Sanitized item for logging
   */
  private sanitizeItemForLogging(item: any): any {
    if (typeof item !== 'object' || item === null) {
      return item
    }

    // Remove potentially sensitive fields
    const sanitized = { ...item }
    const sensitiveFields = ['privateKey', 'secret', 'password', 'token']
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]'
      }
    })

    return sanitized
  }
}