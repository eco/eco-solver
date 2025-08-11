import { Injectable, Logger } from '@nestjs/common'
import { Hex } from 'viem'
import { EcoConfigService } from '../config/eco-config.service'
import { EcoLogMessage, EcoError, BatchWithdraws, SendBatchData, IndexerConfig, ANALYTICS_EVENTS } from '@libs/shared'
import { EcoAnalyticsService } from '../analytics/eco-analytics.service'

export interface FetchOptions extends RequestInit {
  searchParams?: Record<string, string | undefined>
  timeout?: number
  retries?: number
}

export interface ChainDataResponse<T> {
  data: T
  metadata: {
    timestamp: number
    chainId?: number
    source: string
  }
}

@Injectable()
export class ChainDataFetcherService {
  private readonly logger = new Logger(ChainDataFetcherService.name)
  private readonly config: IndexerConfig

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly ecoAnalytics: EcoAnalyticsService
  ) {
    this.config = this.ecoConfigService.getIndexer()
  }

  /**
   * Fetch next batch of withdrawals from indexer service
   * @param intentSourceAddr Optional intent source address filter
   * @returns Promise resolving to batch withdrawals array
   */
  async fetchNextBatchWithdrawals(intentSourceAddr?: Hex): Promise<BatchWithdraws[]> {
    const startTime = Date.now()
    const searchParams = { evt_log_address: intentSourceAddr }
    
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'fetching next batch withdrawals',
        properties: { intentSourceAddr, searchParams }
      })
    )

    try {
      const response = await this.fetch<ChainDataResponse<BatchWithdraws[]>>(
        '/intents/nextBatchWithdrawals',
        { searchParams }
      )

      // Filter out gasless intents if needed
      const filteredWithdrawals = response.data.filter(record => {
        return !this.isGaslessIntent(record)
      })

      // Track successful fetch
      this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.INDEXER.BATCH_WITHDRAWALS_FETCHED, {
        intentSourceAddr,
        totalRecords: response.data.length,
        filteredRecords: filteredWithdrawals.length,
        duration: Date.now() - startTime
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'successfully fetched batch withdrawals',
          properties: { 
            total: response.data.length, 
            filtered: filteredWithdrawals.length,
            duration: Date.now() - startTime
          }
        })
      )

      return filteredWithdrawals
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to fetch batch withdrawals',
          error: EcoError.getErrorObject(error),
          properties: { intentSourceAddr, duration: Date.now() - startTime }
        })
      )

      // Track fetch error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.INDEXER.BATCH_WITHDRAWALS_FETCH_ERROR, error, {
        intentSourceAddr,
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * Fetch next send batch data from indexer service
   * @param intentSourceAddr Optional intent source address filter
   * @returns Promise resolving to send batch data array
   */
  async fetchNextSendBatch(intentSourceAddr?: Hex): Promise<SendBatchData[]> {
    const startTime = Date.now()
    const searchParams = { evt_log_address: intentSourceAddr }
    
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'fetching next send batch',
        properties: { intentSourceAddr, searchParams }
      })
    )

    try {
      const response = await this.fetch<ChainDataResponse<SendBatchData[]>>(
        '/intents/nextBatch',
        { searchParams }
      )

      // Track successful fetch
      this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.INDEXER.SEND_BATCH_FETCHED, {
        intentSourceAddr,
        recordCount: response.data.length,
        duration: Date.now() - startTime
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'successfully fetched send batch data',
          properties: { 
            recordCount: response.data.length,
            duration: Date.now() - startTime
          }
        })
      )

      return response.data
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to fetch send batch data',
          error: EcoError.getErrorObject(error),
          properties: { intentSourceAddr, duration: Date.now() - startTime }
        })
      )

      // Track fetch error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.INDEXER.SEND_BATCH_FETCH_ERROR, error, {
        intentSourceAddr,
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * Generic fetch method with error handling and retries
   * @param endpoint API endpoint to fetch from
   * @param options Fetch options including search params and retry config
   * @returns Promise resolving to typed response data
   */
  private async fetch<Data>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<Data> {
    const { 
      searchParams, 
      timeout = 10000, 
      retries = 3, 
      ...fetchOpts 
    } = options

    const url = new URL(endpoint, this.config.url)

    // Add search parameters if provided
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value)
        }
      })
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
          ...fetchOpts
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        
        // Wrap response with metadata
        return {
          data,
          metadata: {
            timestamp: Date.now(),
            source: url.toString()
          }
        } as Data

      } catch (error) {
        lastError = EcoError.getErrorObject(error)
        
        this.logger.warn(
          EcoLogMessage.withError({
            message: 'fetch attempt failed',
            error: lastError,
            properties: { 
              attempt, 
              maxRetries: retries, 
              endpoint: url.toString(),
              timeout
            }
          })
        )

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          break
        }

        // Wait before retry with exponential backoff
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All attempts failed
    const finalError = new Error(
      `Failed to fetch ${endpoint} after ${retries} attempts: ${lastError?.message}`
    )
    
    this.logger.error(
      EcoLogMessage.withError({
        message: 'all fetch attempts failed',
        error: finalError,
        properties: { 
          endpoint: url.toString(), 
          attempts: retries,
          lastError: lastError?.message
        }
      })
    )

    throw finalError
  }

  /**
   * Check if error should not be retried
   * @param error Error to check
   * @returns True if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    
    // Don't retry client errors (4xx) except for specific cases
    if (message.includes('http 4')) {
      return !message.includes('408') && !message.includes('429') // Timeout and rate limit are retryable
    }

    // Don't retry certain network errors
    if (message.includes('network error') || message.includes('dns')) {
      return true
    }

    return false
  }

  /**
   * Check if a withdrawal record represents a gasless intent
   * @param record Batch withdrawal record to check
   * @returns True if record is gasless intent
   */
  private isGaslessIntent(record: any): boolean {
    return record?.intent && 'intentHash' in record.intent && 'fundingSource' in record.intent
  }

  /**
   * Get indexer service health status
   * @returns Promise resolving to health check result
   */
  async getIndexerHealth(): Promise<{ status: string; timestamp: number; version?: string }> {
    try {
      const response = await this.fetch<{ status: string; version?: string }>('/health', {
        timeout: 5000,
        retries: 1
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'indexer health check successful',
          properties: response
        })
      )

      return {
        ...response,
        timestamp: Date.now()
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'indexer health check failed',
          error: EcoError.getErrorObject(error),
          properties: { indexerUrl: this.config.url }
        })
      )

      return {
        status: 'unhealthy',
        timestamp: Date.now()
      }
    }
  }
}