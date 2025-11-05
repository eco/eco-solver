import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { getIntentJobId } from '@/common/utils/strings'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { IntentCreatedLog } from '@/contracts'
import { Log, PublicClient } from 'viem'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import * as BigIntSerializer from '@/common/utils/serialize'
import { EcoAnalyticsService } from '@/analytics'
import { ERROR_EVENTS } from '@/analytics/events.constants'

/**
 * This service subscribes to IntentSource contracts for IntentCreated events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, it mutates the event log, and then
 * adds it intent queue for processing.
 */
const MAX_BACKFILL_BLOCK_RANGE = 10_000n

@Injectable()
export class WatchCreateIntentService extends WatchEventService<IntentSource> {
  protected logger = new Logger(WatchCreateIntentService.name)

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) protected readonly intentQueue: Queue,
    protected readonly publicClientService: MultichainPublicClientService,
    protected readonly ecoConfigService: EcoConfigService,
    protected readonly ecoAnalytics: EcoAnalyticsService,
  ) {
    super(intentQueue, publicClientService, ecoConfigService, ecoAnalytics)
  }

  /**
   * Subscribes to all IntentSource contracts for IntentCreated events. It subscribes on all supported chains
   * filtering on the prover addresses and destination chain ids. It loads a mapping of the unsubscribe events to
   * call {@link onModuleDestroy} to close the clients.
   */
  async subscribe(): Promise<void> {
    const sources = this.ecoConfigService.getIntentSources()

    // Track subscription start
    this.ecoAnalytics.trackWatchCreateIntentSubscriptionStarted(sources)

    try {
      const subscribeTasks = sources.map(async (source) => {
        const client = await this.publicClientService.getClient(source.chainID)
        await this.subscribeTo(client, source)
      })

      await Promise.all(subscribeTasks)

      // Track successful subscription
      this.ecoAnalytics.trackWatchCreateIntentSubscriptionSuccess(sources)
    } catch (error) {
      // Track subscription failure
      this.ecoAnalytics.trackError(ERROR_EVENTS.WATCH_CREATE_INTENT_SUBSCRIPTION_FAILED, error, {
        sourceCount: sources.length,
        sources,
      })
      throw error
    }
  }

  /**
   * Unsubscribes from all IntentSource contracts. It closes all clients in {@link onModuleDestroy}
   */
  async unsubscribe() {
    super.unsubscribe()
  }

  async subscribeTo(client: PublicClient, source: IntentSource) {
    const chainID = Number(source.chainID)
    const fromBlock = this.getNextFromBlock(chainID)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch create intent: subscribeToSource`,
        properties: {
          source,
        },
      }),
    )

    this.unwatch[chainID] = client.watchContractEvent({
      onError: async (error) => {
        await this.onError(error, client, source)
      },
      address: source.sourceAddress,
      abi: IntentSourceAbi,
      eventName: 'IntentCreated',
      args: {
        // // restrict by acceptable chains, chain ids must be bigints
        // _destinationChain: solverSupportedChains,
        prover: source.provers,
      },
      fromBlock,
      onLogs: this.addJob(source),
    })
  }

  addJob(source: IntentSource): (logs: Log[]) => Promise<void> {
    return async (logs: IntentCreatedLog[]) => {
      // Track batch of events detected
      if (logs.length > 0) {
        this.ecoAnalytics.trackWatchCreateIntentEventsDetected(logs.length, source)
      }

      // Track the highest successfully processed block and the earliest failed block.
      // We will only advance the cursor to the last safe block that guarantees no skipped logs.
      let maxSuccessBlock: bigint | undefined
      let minFailedBlock: bigint | undefined

      await this.processLogsResiliently(
        logs,
        async (log) => {
          const blockNum = typeof log.blockNumber === 'bigint' ? log.blockNumber : undefined
          log.sourceChainID = BigInt(source.chainID)
          log.sourceNetwork = source.network

          // bigint as it can't serialize to JSON
          const createIntent = BigIntSerializer.serialize(log)
          const jobId = getIntentJobId(
            'watch-create-intent',
            createIntent.args.hash,
            createIntent.logIndex,
          )
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: `watch intent`,
              properties: { createIntent, jobId },
            }),
          )

          try {
            // add to processing queue
            await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.create_intent, createIntent, {
              jobId,
              ...this.watchJobConfig,
            })

            // Track successful job addition
            this.ecoAnalytics.trackWatchCreateIntentJobQueued(createIntent, jobId, source)
          } catch (error) {
            // Track job queue failure with complete context
            this.ecoAnalytics.trackWatchJobQueueError(
              error,
              ERROR_EVENTS.CREATE_INTENT_JOB_QUEUE_FAILED,
              {
                createIntent,
                jobId,
                source,
                transactionHash: createIntent.transactionHash,
                logIndex: createIntent.logIndex,
              },
            )
            // Record earliest failed block so we do not advance beyond it
            if (blockNum !== undefined) {
              if (minFailedBlock === undefined || blockNum < minFailedBlock) {
                minFailedBlock = blockNum
              }
            }
            throw error
          }
          // Record highest successful block
          if (blockNum !== undefined) {
            if (maxSuccessBlock === undefined || blockNum > maxSuccessBlock) {
              maxSuccessBlock = blockNum
            }
          }
        },
        'watch create-intent',
      )

      const chainIDNum = Number(source.chainID)
      const previous = this['lastProcessedBlockByChain'][chainIDNum]

      // If any failures occurred, only advance to just before the earliest failed block.
      // Otherwise, advance to the highest successful block.
      let nextCursor: bigint | undefined
      if (minFailedBlock !== undefined) {
        if (minFailedBlock > 0n) {
          const candidate = minFailedBlock - 1n
          if (previous === undefined || candidate > previous) {
            nextCursor = candidate
          }
        }
      } else if (maxSuccessBlock !== undefined) {
        nextCursor = maxSuccessBlock
      }

      if (nextCursor !== undefined) {
        this.recordProcessedBlock(chainIDNum, nextCursor)
      }
    }
  }

  protected override async fetchBackfillLogs(
    client: PublicClient,
    source: IntentSource,
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<Log[]> {
    let effectiveFromBlock = fromBlock
    if (toBlock - fromBlock > MAX_BACKFILL_BLOCK_RANGE) {
      effectiveFromBlock =
        toBlock > MAX_BACKFILL_BLOCK_RANGE ? toBlock - MAX_BACKFILL_BLOCK_RANGE : 0n
    }

    const supportedChains = this.ecoConfigService.getSupportedChains()

    const logs = await client.getContractEvents({
      address: source.sourceAddress,
      abi: portalAbi,
      eventName: 'IntentPublished',
      strict: true,
      args: {
        prover: source.provers,
      },
      fromBlock: effectiveFromBlock,
      toBlock,
    })

    return logs.filter((log) => supportedChains.includes(log.args.destination)) as Log[]
  }
}
