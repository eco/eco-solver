import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue, JobsOptions } from 'bull'
import { IntentCreatedLog, IntentFundedLog, FulfillmentLog, EcoLogMessage, EcoError, serialize } from '@libs/shared'
import { EcoAnalyticsService } from '@libs/integrations'
import { ChainIndexerJobUtils } from '@libs/shared'

export interface IntentJobConfig extends JobsOptions {
  removeOnComplete?: boolean | number
  removeOnFail?: boolean | number
  delay?: number
  priority?: number
}

export interface QueueMetrics {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

@Injectable()
export class IntentEventQueueManager {
  private readonly logger = new Logger(IntentEventQueueManager.name)

  constructor(
    @InjectQueue('source-intent') private readonly sourceIntentQueue: Queue,
    @InjectQueue('intent-fulfillment') private readonly fulfillmentQueue: Queue,
    private readonly ecoAnalytics: EcoAnalyticsService
  ) {}

  /**
   * Queue an intent created event for processing
   * @param createIntent Intent created log data
   * @param source Intent source information
   * @param jobConfig Job configuration options
   */
  async queueIntentCreated(
    createIntent: IntentCreatedLog,
    source: any,
    jobConfig: IntentJobConfig = {}
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Serialize bigint values for queue storage
      const serializedIntent = serialize(createIntent)
      
      const jobId = ChainIndexerJobUtils.getIntentJobId(
        'intent-created',
        createIntent.args.hash,
        createIntent.logIndex || 0
      )

      const jobOptions: JobsOptions = {
        jobId,
        priority: this.calculatePriority(createIntent.sourceChainID, 'created'),
        ...jobConfig
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'queueing intent created event',
          properties: { 
            intentHash: createIntent.args.hash,
            jobId,
            sourceChainID: createIntent.sourceChainID.toString(),
            priority: jobOptions.priority
          }
        })
      )

      await this.sourceIntentQueue.add('process-intent-created', {
        intent: serializedIntent,
        source,
        metadata: {
          queuedAt: Date.now(),
          sourceChainID: createIntent.sourceChainID.toString(),
          intentHash: createIntent.args.hash
        }
      }, jobOptions)

      // Track successful job queuing
      this.ecoAnalytics.trackEvent('intent.created.queued', {
        intentHash: createIntent.args.hash,
        sourceChainID: createIntent.sourceChainID.toString(),
        jobId,
        priority: jobOptions.priority,
        duration: Date.now() - startTime
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'successfully queued intent created event',
          properties: { 
            intentHash: createIntent.args.hash,
            jobId,
            duration: Date.now() - startTime
          }
        })
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to queue intent created event',
          error: EcoError.getErrorObject(error),
          properties: { 
            intentHash: createIntent.args.hash,
            sourceChainID: createIntent.sourceChainID.toString(),
            duration: Date.now() - startTime
          }
        })
      )

      // Track queue error
      this.ecoAnalytics.trackError('intent.created.queue.error', error, {
        intentHash: createIntent.args.hash,
        sourceChainID: createIntent.sourceChainID.toString(),
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * Queue an intent funded event for processing
   * @param intentHash Intent hash that was funded
   * @param fundedLog Intent funded log data
   * @param jobConfig Job configuration options
   */
  async queueIntentFunded(
    intentHash: string,
    fundedLog: IntentFundedLog,
    jobConfig: IntentJobConfig = {}
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      const jobId = ChainIndexerJobUtils.getIntentJobId(
        'intent-funded',
        intentHash,
        fundedLog.logIndex || 0
      )

      const jobOptions: JobsOptions = {
        jobId,
        priority: this.calculatePriority(fundedLog.sourceChainID, 'funded'),
        ...jobConfig
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'queueing intent funded event',
          properties: { 
            intentHash,
            jobId,
            sourceChainID: fundedLog.sourceChainID.toString(),
            priority: jobOptions.priority
          }
        })
      )

      await this.sourceIntentQueue.add('process-intent-funded', {
        intentHash,
        fundedLog: serialize(fundedLog),
        metadata: {
          queuedAt: Date.now(),
          sourceChainID: fundedLog.sourceChainID.toString(),
          intentHash
        }
      }, jobOptions)

      // Track successful job queuing
      this.ecoAnalytics.trackEvent('intent.funded.queued', {
        intentHash,
        sourceChainID: fundedLog.sourceChainID.toString(),
        jobId,
        priority: jobOptions.priority,
        duration: Date.now() - startTime
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'successfully queued intent funded event',
          properties: { 
            intentHash,
            jobId,
            duration: Date.now() - startTime
          }
        })
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to queue intent funded event',
          error: EcoError.getErrorObject(error),
          properties: { 
            intentHash,
            sourceChainID: fundedLog.sourceChainID.toString(),
            duration: Date.now() - startTime
          }
        })
      )

      // Track queue error
      this.ecoAnalytics.trackError('intent.funded.queue.error', error, {
        intentHash,
        sourceChainID: fundedLog.sourceChainID.toString(),
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * Queue a fulfillment event for processing
   * @param fulfillment Fulfillment log data
   * @param solver Solver information
   * @param jobConfig Job configuration options
   */
  async queueFulfillmentEvent(
    fulfillment: FulfillmentLog,
    solver: any,
    jobConfig: IntentJobConfig = {}
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      const jobId = ChainIndexerJobUtils.getIntentJobId(
        'intent-fulfillment',
        fulfillment.args._hash,
        fulfillment.logIndex || 0
      )

      const jobOptions: JobsOptions = {
        jobId,
        priority: this.calculatePriority(fulfillment.args._sourceChainID, 'fulfillment'),
        ...jobConfig
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'queueing fulfillment event',
          properties: { 
            intentHash: fulfillment.args._hash,
            jobId,
            sourceChainID: fulfillment.args._sourceChainID.toString(),
            priority: jobOptions.priority
          }
        })
      )

      await this.fulfillmentQueue.add('process-fulfillment', {
        fulfillment: serialize(fulfillment),
        solver,
        metadata: {
          queuedAt: Date.now(),
          sourceChainID: fulfillment.args._sourceChainID.toString(),
          intentHash: fulfillment.args._hash
        }
      }, jobOptions)

      // Track successful job queuing
      this.ecoAnalytics.trackEvent('intent.fulfillment.queued', {
        intentHash: fulfillment.args._hash,
        sourceChainID: fulfillment.args._sourceChainID.toString(),
        jobId,
        priority: jobOptions.priority,
        duration: Date.now() - startTime
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'successfully queued fulfillment event',
          properties: { 
            intentHash: fulfillment.args._hash,
            jobId,
            duration: Date.now() - startTime
          }
        })
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to queue fulfillment event',
          error: EcoError.getErrorObject(error),
          properties: { 
            intentHash: fulfillment.args._hash,
            sourceChainID: fulfillment.args._sourceChainID.toString(),
            duration: Date.now() - startTime
          }
        })
      )

      // Track queue error
      this.ecoAnalytics.trackError('intent.fulfillment.queue.error', error, {
        intentHash: fulfillment.args._hash,
        sourceChainID: fulfillment.args._sourceChainID.toString(),
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * Get queue metrics for monitoring
   * @param queueName Name of queue to get metrics for
   * @returns Promise resolving to queue metrics
   */
  async getQueueMetrics(queueName: 'source-intent' | 'fulfillment'): Promise<QueueMetrics> {
    try {
      const queue = queueName === 'source-intent' ? this.sourceIntentQueue : this.fulfillmentQueue
      
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed()
      ])

      const metrics: QueueMetrics = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'retrieved queue metrics',
          properties: { queueName, ...metrics }
        })
      )

      return metrics
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to get queue metrics',
          error: EcoError.getErrorObject(error),
          properties: { queueName }
        })
      )

      throw error
    }
  }

  /**
   * Pause a specific queue
   * @param queueName Name of queue to pause
   */
  async pauseQueue(queueName: 'source-intent' | 'fulfillment'): Promise<void> {
    try {
      const queue = queueName === 'source-intent' ? this.sourceIntentQueue : this.fulfillmentQueue
      await queue.pause()

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'queue paused',
          properties: { queueName }
        })
      )

      // Track queue pause
      this.ecoAnalytics.trackEvent('queue.paused', { queueName })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to pause queue',
          error: EcoError.getErrorObject(error),
          properties: { queueName }
        })
      )

      throw error
    }
  }

  /**
   * Resume a specific queue
   * @param queueName Name of queue to resume
   */
  async resumeQueue(queueName: 'source-intent' | 'fulfillment'): Promise<void> {
    try {
      const queue = queueName === 'source-intent' ? this.sourceIntentQueue : this.fulfillmentQueue
      await queue.resume()

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'queue resumed',
          properties: { queueName }
        })
      )

      // Track queue resume
      this.ecoAnalytics.trackEvent('queue.resumed', { queueName })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to resume queue',
          error: EcoError.getErrorObject(error),
          properties: { queueName }
        })
      )

      throw error
    }
  }

  /**
   * Calculate job priority based on chain ID and event type
   * @param sourceChainID Source chain ID
   * @param eventType Type of event (created, funded, fulfillment)
   * @returns Priority score (higher = more priority)
   */
  private calculatePriority(sourceChainID: bigint, eventType: 'created' | 'funded' | 'fulfillment'): number {
    const chainId = Number(sourceChainID)
    
    // Base priority by chain importance
    let basePriority = 1
    if ([1, 10, 137, 42161].includes(chainId)) { // Major mainnets
      basePriority = 10
    } else if ([8453, 56, 43114].includes(chainId)) { // Other important chains
      basePriority = 5
    }

    // Event type multiplier
    const eventMultiplier = {
      'funded': 3,      // Highest priority - funds are available
      'fulfillment': 2, // Medium priority - fulfillment events
      'created': 1      // Lowest priority - just created
    }

    return basePriority * eventMultiplier[eventType]
  }
}