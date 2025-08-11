import { Injectable, Logger } from '@nestjs/common'
import { JobsOptions } from 'bull'
import { IntentCreatedLog, FulfillmentLog, IntentSource, EcoLogMessage, serialize, ChainIndexerJobUtils } from '@libs/shared'
import { Log } from 'viem'

export interface JobData {
  id: string
  name: string
  data: any
  options: JobsOptions
}

export interface IntentJobData extends JobData {
  data: {
    intent: any // Serialized intent data
    source: IntentSource
    metadata: {
      createdAt: number
      chainId: number
      intentHash: string
      logIndex: number
    }
  }
}

export interface FulfillmentJobData extends JobData {
  data: {
    fulfillment: any // Serialized fulfillment data
    solver: any
    metadata: {
      createdAt: number
      chainId: number
      intentHash: string
      logIndex: number
    }
  }
}

export interface SyncJobData extends JobData {
  data: {
    logs: Log[]
    source: IntentSource
    syncType: 'full' | 'incremental' | 'priority'
    metadata: {
      createdAt: number
      chainId: number
      fromBlock: string
      toBlock: string
    }
  }
}

@Injectable()
export class EventJobFactory {
  private readonly logger = new Logger(EventJobFactory.name)

  /**
   * Create job data for intent created event
   * @param intent Intent created log
   * @param source Intent source configuration
   * @param options Additional job options
   * @returns Intent job data
   */
  createIntentJob(
    intent: IntentCreatedLog,
    source: IntentSource,
    options: Partial<JobsOptions> = {}
  ): IntentJobData {
    const jobId = ChainIndexerJobUtils.getIntentJobId(
      'intent-created',
      intent.args.hash,
      intent.logIndex || 0
    )

    const jobOptions: JobsOptions = {
      jobId,
      priority: this.calculateIntentPriority(intent.sourceChainID, 'created'),
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      ...options
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'creating intent job',
        properties: {
          jobId,
          intentHash: intent.args.hash,
          sourceChainId: intent.sourceChainID.toString(),
          priority: jobOptions.priority
        }
      })
    )

    return {
      id: jobId,
      name: 'process-intent-created',
      data: {
        intent: serialize(intent),
        source,
        metadata: {
          createdAt: Date.now(),
          chainId: Number(intent.sourceChainID),
          intentHash: intent.args.hash,
          logIndex: intent.logIndex || 0
        }
      },
      options: jobOptions
    }
  }

  /**
   * Create job data for fulfillment event
   * @param fulfillment Fulfillment log
   * @param solver Solver configuration
   * @param options Additional job options
   * @returns Fulfillment job data
   */
  createFulfillmentJob(
    fulfillment: FulfillmentLog,
    solver: any,
    options: Partial<JobsOptions> = {}
  ): FulfillmentJobData {
    const jobId = ChainIndexerJobUtils.getIntentJobId(
      'intent-fulfillment',
      fulfillment.args._hash,
      fulfillment.logIndex || 0
    )

    const jobOptions: JobsOptions = {
      jobId,
      priority: this.calculateIntentPriority(fulfillment.args._sourceChainID, 'fulfillment'),
      removeOnComplete: 30,
      removeOnFail: 15,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      ...options
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'creating fulfillment job',
        properties: {
          jobId,
          intentHash: fulfillment.args._hash,
          sourceChainId: fulfillment.args._sourceChainID.toString(),
          priority: jobOptions.priority
        }
      })
    )

    return {
      id: jobId,
      name: 'process-fulfillment',
      data: {
        fulfillment: serialize(fulfillment),
        solver,
        metadata: {
          createdAt: Date.now(),
          chainId: Number(fulfillment.args._sourceChainID),
          intentHash: fulfillment.args._hash,
          logIndex: fulfillment.logIndex || 0
        }
      },
      options: jobOptions
    }
  }

  /**
   * Create job data for sync operation
   * @param logs Array of logs to sync
   * @param source Intent source configuration
   * @param syncType Type of sync operation
   * @param blockRange Block range being synced
   * @param options Additional job options
   * @returns Sync job data
   */
  createSyncJob(
    logs: Log[],
    source: IntentSource,
    syncType: 'full' | 'incremental' | 'priority',
    blockRange: { fromBlock: bigint; toBlock: bigint },
    options: Partial<JobsOptions> = {}
  ): SyncJobData {
    const jobId = this.generateSyncJobId(source.chainID, blockRange, syncType)

    const jobOptions: JobsOptions = {
      jobId,
      priority: this.calculateSyncPriority(source.chainID, syncType, logs.length),
      removeOnComplete: 20,
      removeOnFail: 10,
      attempts: syncType === 'priority' ? 5 : 3,
      backoff: {
        type: 'exponential',
        delay: syncType === 'priority' ? 1000 : 3000
      },
      ...options
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'creating sync job',
        properties: {
          jobId,
          sourceChainId: source.chainID,
          syncType,
          logCount: logs.length,
          fromBlock: blockRange.fromBlock.toString(),
          toBlock: blockRange.toBlock.toString(),
          priority: jobOptions.priority
        }
      })
    )

    return {
      id: jobId,
      name: `sync-${syncType}`,
      data: {
        logs: logs.map(log => serialize(log)),
        source,
        syncType,
        metadata: {
          createdAt: Date.now(),
          chainId: source.chainID,
          fromBlock: blockRange.fromBlock.toString(),
          toBlock: blockRange.toBlock.toString()
        }
      },
      options: jobOptions
    }
  }

  /**
   * Create batch of intent jobs
   * @param intents Array of intent created logs
   * @param source Intent source configuration
   * @param batchOptions Options applied to all jobs in batch
   * @returns Array of intent job data
   */
  createIntentJobBatch(
    intents: IntentCreatedLog[],
    source: IntentSource,
    batchOptions: Partial<JobsOptions> = {}
  ): IntentJobData[] {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'creating intent job batch',
        properties: {
          intentCount: intents.length,
          sourceChainId: source.chainID
        }
      })
    )

    return intents.map(intent => this.createIntentJob(intent, source, batchOptions))
  }

  /**
   * Create batch of fulfillment jobs
   * @param fulfillments Array of fulfillment logs
   * @param solver Solver configuration
   * @param batchOptions Options applied to all jobs in batch
   * @returns Array of fulfillment job data
   */
  createFulfillmentJobBatch(
    fulfillments: FulfillmentLog[],
    solver: any,
    batchOptions: Partial<JobsOptions> = {}
  ): FulfillmentJobData[] {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'creating fulfillment job batch',
        properties: {
          fulfillmentCount: fulfillments.length
        }
      })
    )

    return fulfillments.map(fulfillment => 
      this.createFulfillmentJob(fulfillment, solver, batchOptions)
    )
  }

  /**
   * Create delayed job for retry/scheduling
   * @param baseJob Base job data
   * @param delayMs Delay in milliseconds
   * @param reason Reason for delay
   * @returns Modified job data with delay
   */
  createDelayedJob<T extends JobData>(
    baseJob: T,
    delayMs: number,
    reason: string
  ): T {
    const delayedJob = {
      ...baseJob,
      options: {
        ...baseJob.options,
        delay: delayMs,
        jobId: `${baseJob.id}-delayed-${Date.now()}`
      }
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'creating delayed job',
        properties: {
          originalJobId: baseJob.id,
          delayedJobId: delayedJob.options.jobId,
          delayMs,
          reason
        }
      })
    )

    return delayedJob
  }

  /**
   * Calculate priority for intent-related jobs
   * @param sourceChainID Source chain ID
   * @param eventType Type of event
   * @returns Priority score
   */
  private calculateIntentPriority(
    sourceChainID: bigint,
    eventType: 'created' | 'funded' | 'fulfillment'
  ): number {
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

  /**
   * Calculate priority for sync jobs
   * @param chainId Chain ID
   * @param syncType Type of sync
   * @param logCount Number of logs
   * @returns Priority score
   */
  private calculateSyncPriority(
    chainId: number,
    syncType: 'full' | 'incremental' | 'priority',
    logCount: number
  ): number {
    // Base priority by sync type
    const syncPriority = {
      'priority': 100,
      'incremental': 50,
      'full': 20
    }

    // Chain importance multiplier
    let chainMultiplier = 1
    if ([1, 10, 137, 42161].includes(chainId)) {
      chainMultiplier = 2
    } else if ([8453, 56, 43114].includes(chainId)) {
      chainMultiplier = 1.5
    }

    // Log count consideration (more logs = slightly higher priority)
    const logMultiplier = Math.min(1 + (logCount / 100), 2)

    return Math.floor(syncPriority[syncType] * chainMultiplier * logMultiplier)
  }

  /**
   * Generate unique job ID for sync operations
   * @param chainId Chain ID
   * @param blockRange Block range
   * @param syncType Sync type
   * @returns Unique job ID
   */
  private generateSyncJobId(
    chainId: number,
    blockRange: { fromBlock: bigint; toBlock: bigint },
    syncType: string
  ): string {
    const timestamp = Date.now()
    return `sync-${syncType}-${chainId}-${blockRange.fromBlock.toString()}-${blockRange.toBlock.toString()}-${timestamp}`
  }
}