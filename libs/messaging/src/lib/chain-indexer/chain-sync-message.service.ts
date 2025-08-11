import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue, Job } from 'bull'
import { Log } from 'viem'
import { EcoLogMessage, EcoError, IntentSource } from '@libs/shared'
import { EcoAnalyticsService } from '@libs/integrations'

export interface SyncJobData {
  logs: Log[]
  source: IntentSource
  batchId: string
  priority: number
  metadata: {
    fromBlock: string
    toBlock: string
    chainId: number
    timestamp: number
  }
}

export interface BatchJobData {
  jobs: Array<{
    id: string
    type: string
    data: any
    priority: number
  }>
  batchId: string
  chainId: number
}

@Injectable()
export class ChainSyncMessageService {
  private readonly logger = new Logger(ChainSyncMessageService.name)

  constructor(
    @InjectQueue('chain-sync') private readonly chainSyncQueue: Queue,
    @InjectQueue('batch-processing') private readonly batchQueue: Queue,
    private readonly ecoAnalytics: EcoAnalyticsService
  ) {}

  /**
   * Process missed transactions by queuing them for sync
   * @param source Intent source configuration
   * @param logs Array of missed transaction logs
   * @param metadata Additional sync metadata
   */
  async processMissedTransactions(
    source: IntentSource,
    logs: Log[],
    metadata: { fromBlock: bigint; toBlock: bigint }
  ): Promise<void> {
    const startTime = Date.now()
    const batchId = this.generateBatchId(source.chainID, metadata.fromBlock, metadata.toBlock)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'processing missed transactions',
        properties: {
          sourceChainId: source.chainID,
          logCount: logs.length,
          fromBlock: metadata.fromBlock.toString(),
          toBlock: metadata.toBlock.toString(),
          batchId
        }
      })
    )

    try {
      // Split large batches to avoid overwhelming the queue
      const batches = this.splitLogsIntoBatches(logs, 50)
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const subBatchId = `${batchId}-${i}`
        
        const jobData: SyncJobData = {
          logs: batch,
          source,
          batchId: subBatchId,
          priority: this.calculateSyncPriority(source.chainID, batch.length),
          metadata: {
            fromBlock: metadata.fromBlock.toString(),
            toBlock: metadata.toBlock.toString(),
            chainId: source.chainID,
            timestamp: Date.now()
          }
        }

        await this.chainSyncQueue.add('process-missed-transactions', jobData, {
          jobId: subBatchId,
          priority: jobData.priority,
          removeOnComplete: 10,
          removeOnFail: 5
        })
      }

      // Track successful processing
      this.ecoAnalytics.trackEvent('chain.sync.missed_transactions.queued', {
        sourceChainId: source.chainID,
        logCount: logs.length,
        batchCount: batches.length,
        batchId,
        duration: Date.now() - startTime
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'successfully queued missed transactions',
          properties: {
            sourceChainId: source.chainID,
            logCount: logs.length,
            batchCount: batches.length,
            batchId,
            duration: Date.now() - startTime
          }
        })
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to process missed transactions',
          error: EcoError.getErrorObject(error),
          properties: {
            sourceChainId: source.chainID,
            logCount: logs.length,
            batchId,
            duration: Date.now() - startTime
          }
        })
      )

      // Track processing error
      this.ecoAnalytics.trackError('chain.sync.missed_transactions.error', error, {
        sourceChainId: source.chainID,
        logCount: logs.length,
        batchId,
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * Handle batch processing of multiple job types
   * @param jobs Array of jobs to process in batch
   * @param chainId Chain ID for the batch
   * @param priority Batch priority
   */
  async handleBatchProcessing(
    jobs: Array<{ id: string; type: string; data: any; priority: number }>,
    chainId: number,
    priority = 1
  ): Promise<void> {
    const startTime = Date.now()
    const batchId = this.generateBatchId(chainId, BigInt(Date.now()))

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'handling batch processing',
        properties: {
          chainId,
          jobCount: jobs.length,
          batchId,
          priority
        }
      })
    )

    try {
      const batchData: BatchJobData = {
        jobs,
        batchId,
        chainId
      }

      await this.batchQueue.add('process-job-batch', batchData, {
        jobId: batchId,
        priority,
        removeOnComplete: 5,
        removeOnFail: 3
      })

      // Track successful batch queuing
      this.ecoAnalytics.trackEvent('chain.sync.batch.queued', {
        chainId,
        jobCount: jobs.length,
        batchId,
        priority,
        duration: Date.now() - startTime
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'successfully queued batch processing',
          properties: {
            chainId,
            jobCount: jobs.length,
            batchId,
            duration: Date.now() - startTime
          }
        })
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to handle batch processing',
          error: EcoError.getErrorObject(error),
          properties: {
            chainId,
            jobCount: jobs.length,
            batchId,
            duration: Date.now() - startTime
          }
        })
      )

      // Track batch error
      this.ecoAnalytics.trackError('chain.sync.batch.error', error, {
        chainId,
        jobCount: jobs.length,
        batchId,
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * Queue priority sync for critical chain data
   * @param source Intent source
   * @param logs High priority logs
   * @param reason Reason for priority sync
   */
  async queuePrioritySync(
    source: IntentSource,
    logs: Log[],
    reason: string
  ): Promise<void> {
    const startTime = Date.now()
    const batchId = this.generateBatchId(source.chainID, BigInt(Date.now()), 'priority')

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'queueing priority sync',
        properties: {
          sourceChainId: source.chainID,
          logCount: logs.length,
          reason,
          batchId
        }
      })
    )

    try {
      const jobData: SyncJobData = {
        logs,
        source,
        batchId,
        priority: 100, // Highest priority
        metadata: {
          fromBlock: '0',
          toBlock: 'latest',
          chainId: source.chainID,
          timestamp: Date.now()
        }
      }

      await this.chainSyncQueue.add('priority-sync', jobData, {
        jobId: batchId,
        priority: 100,
        removeOnComplete: 20,
        removeOnFail: 10
      })

      // Track priority sync
      this.ecoAnalytics.trackEvent('chain.sync.priority.queued', {
        sourceChainId: source.chainID,
        logCount: logs.length,
        reason,
        batchId,
        duration: Date.now() - startTime
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'successfully queued priority sync',
          properties: {
            sourceChainId: source.chainID,
            logCount: logs.length,
            batchId,
            duration: Date.now() - startTime
          }
        })
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to queue priority sync',
          error: EcoError.getErrorObject(error),
          properties: {
            sourceChainId: source.chainID,
            logCount: logs.length,
            reason,
            batchId,
            duration: Date.now() - startTime
          }
        })
      )

      throw error
    }
  }

  /**
   * Get sync queue status and metrics
   * @returns Promise resolving to queue status
   */
  async getSyncQueueStatus(): Promise<{
    chainSync: { waiting: number; active: number; completed: number; failed: number }
    batchProcessing: { waiting: number; active: number; completed: number; failed: number }
  }> {
    try {
      const [chainSyncJobs, batchJobs] = await Promise.all([
        Promise.all([
          this.chainSyncQueue.getWaiting(),
          this.chainSyncQueue.getActive(),
          this.chainSyncQueue.getCompleted(),
          this.chainSyncQueue.getFailed()
        ]),
        Promise.all([
          this.batchQueue.getWaiting(),
          this.batchQueue.getActive(),
          this.batchQueue.getCompleted(),
          this.batchQueue.getFailed()
        ])
      ])

      const status = {
        chainSync: {
          waiting: chainSyncJobs[0].length,
          active: chainSyncJobs[1].length,
          completed: chainSyncJobs[2].length,
          failed: chainSyncJobs[3].length
        },
        batchProcessing: {
          waiting: batchJobs[0].length,
          active: batchJobs[1].length,
          completed: batchJobs[2].length,
          failed: batchJobs[3].length
        }
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'retrieved sync queue status',
          properties: status
        })
      )

      return status
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to get sync queue status',
          error: EcoError.getErrorObject(error)
        })
      )

      throw error
    }
  }

  /**
   * Retry failed sync jobs
   * @param maxRetries Maximum number of jobs to retry
   */
  async retryFailedSyncJobs(maxRetries = 10): Promise<void> {
    try {
      const failedJobs = await this.chainSyncQueue.getFailed()
      const jobsToRetry = failedJobs.slice(0, maxRetries)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'retrying failed sync jobs',
          properties: {
            totalFailed: failedJobs.length,
            retrying: jobsToRetry.length
          }
        })
      )

      for (const job of jobsToRetry) {
        try {
          await job.retry()
          
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: 'retried failed job',
              properties: { jobId: job.id, jobName: job.name }
            })
          )
        } catch (retryError) {
          this.logger.error(
            EcoLogMessage.withError({
              message: 'failed to retry job',
              error: EcoError.getErrorObject(retryError),
              properties: { jobId: job.id, jobName: job.name }
            })
          )
        }
      }

      // Track retry operation
      this.ecoAnalytics.trackEvent('chain.sync.failed_jobs.retried', {
        totalFailed: failedJobs.length,
        retriedCount: jobsToRetry.length
      })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to retry failed sync jobs',
          error: EcoError.getErrorObject(error)
        })
      )

      throw error
    }
  }

  /**
   * Split logs into smaller batches for processing
   * @param logs Array of logs to split
   * @param batchSize Size of each batch
   * @returns Array of log batches
   */
  private splitLogsIntoBatches(logs: Log[], batchSize: number): Log[][] {
    const batches: Log[][] = []
    for (let i = 0; i < logs.length; i += batchSize) {
      batches.push(logs.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Calculate sync priority based on chain ID and log count
   * @param chainId Chain ID
   * @param logCount Number of logs
   * @returns Priority score
   */
  private calculateSyncPriority(chainId: number, logCount: number): number {
    // Base priority by chain importance
    let basePriority = 1
    if ([1, 10, 137, 42161].includes(chainId)) {
      basePriority = 10
    } else if ([8453, 56, 43114].includes(chainId)) {
      basePriority = 5
    }

    // Increase priority for larger batches
    const logMultiplier = Math.min(Math.ceil(logCount / 10), 3)

    return basePriority * logMultiplier
  }

  /**
   * Generate unique batch ID
   * @param chainId Chain ID
   * @param blockNumber Block number
   * @param suffix Optional suffix
   * @returns Unique batch ID
   */
  private generateBatchId(chainId: number, blockNumber: bigint, suffix?: string): string {
    const timestamp = Date.now()
    const base = `sync-${chainId}-${blockNumber.toString()}-${timestamp}`
    return suffix ? `${base}-${suffix}` : base
  }
}