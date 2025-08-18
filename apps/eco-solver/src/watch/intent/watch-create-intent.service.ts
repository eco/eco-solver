import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@eco-solver/common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { getIntentJobId } from '@eco-solver/common/utils/strings'
import { IntentSource } from '@eco-solver/eco-configs/eco-config.types'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service'
import { IntentCreatedLog } from '@eco-solver/contracts'
import { Log, PublicClient } from 'viem'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { WatchEventService } from '@eco-solver/watch/intent/watch-event.service'
import * as BigIntSerializer from '@eco-solver/common/utils/serialize'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { ERROR_EVENTS } from '@eco-solver/analytics/events.constants'

/**
 * This service subscribes to IntentSource contracts for IntentCreated events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, it mutates the event log, and then
 * adds it intent queue for processing.
 */
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
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch create intent: subscribeToSource`,
        properties: {
          source,
        },
      }),
    )

    this.unwatch[source.chainID] = client.watchContractEvent({
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
      onLogs: this.addJob(source),
    })
  }

  addJob(source: IntentSource): (logs: Log[]) => Promise<void> {
    return async (logs: IntentCreatedLog[]) => {
      // Track batch of events detected
      if (logs.length > 0) {
        this.ecoAnalytics.trackWatchCreateIntentEventsDetected(logs.length, source)
      }

      for (const log of logs) {
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
          throw error
        }
      }
    }
  }
}
