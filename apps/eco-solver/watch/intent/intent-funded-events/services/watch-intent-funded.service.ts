import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoConfigService } from '@eco/infrastructure-config'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { getIntentJobId } from '@eco/utils'
import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentFundedEventModel } from '@eco/infrastructure-database'
import { IntentFundedLog } from '@/contracts'
import { IntentSource } from '@eco/infrastructure-config'
import { IntentSourceAbi } from '@eco/foundation-eco-adapter'
import { Log, PublicClient } from 'viem'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@eco/infrastructure-redis'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import { EcoAnalyticsService } from '@eco/infrastructure-external-apis'
import { ERROR_EVENTS } from '@eco/infrastructure-external-apis'
import { IntentFundedEventRepository } from '@/watch/intent/intent-funded-events/repositories/intent-funded-event.repository'
import { Network } from '@/common/alchemy/network'

/**
 * This service subscribes to IntentSource contracts for IntentFunded events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, it mutates the event log, and then
 * adds it intent queue for processing.
 */
@Injectable()
export class WatchIntentFundedService extends WatchEventService<IntentSource> {
  protected logger = new Logger(WatchIntentFundedService.name)

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) protected readonly intentQueue: Queue,
    private readonly intentFundedEventRepository: IntentFundedEventRepository,
    protected readonly publicClientService: MultichainPublicClientService,
    private createIntentService: CreateIntentService,
    protected readonly ecoConfigService: EcoConfigService,
    protected readonly ecoAnalytics: EcoAnalyticsService,
  ) {
    super(intentQueue, publicClientService, ecoConfigService, ecoAnalytics)
  }

  /**
   * Subscribes to all IntentSource contracts for IntentFunded events. It subscribes on all supported chains
   * filtering on the prover addresses and destination chain ids. It loads a mapping of the unsubscribe events to
   * call {@link onModuleDestroy} to close the clients.
   */
  async subscribe(): Promise<void> {
    const subscribeTasks = this.ecoConfigService.getIntentSources().map(async (source) => {
      const client = await this.publicClientService.getClient(source.chainID)
      await this.subscribeTo(client, source)
    })

    await Promise.all(subscribeTasks)
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
        message: `watch intent funded: subscribeToSource`,
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
      eventName: 'IntentFunded',
      args: {
        // // restrict by acceptable chains, chain ids must be bigints
        // _destinationChain: solverSupportedChains,
        prover: source.provers,
      },
      onLogs: async (logs: Log[]): Promise<void> => {
        // Track intent funded events detected
        if (logs.length > 0) {
          this.ecoAnalytics.trackWatchIntentFundedEventsDetected(logs.length, source)
        }
        await this.addJob(source, { doValidation: true })(logs)
      },
    })
  }

  private async isOurIntent(log: IntentFundedLog): Promise<boolean> {
    /* Make sure it's one of ours. It might not be ours because:
     * .The intent was created by another solver, so won't be in our database.
     * .The intent was not even a gasless one! Remember, publishAndFund() *also* emits IntentFunded events,
     *  and those ones are not gasless intents.
     */
    const { error } = await this.createIntentService.getIntentForHash(log.args.intentHash)

    if (error) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `IntentFunded event is not ours, skipping`,
          properties: {
            intentHash: log.args.intentHash,
          },
        }),
      )
    }

    return !error
  }

  addJob(source: IntentSource, opts?: { doValidation?: boolean }): (logs: Log[]) => Promise<void> {
    return async (logs: Log[]) => {
      for (const logEntry of logs) {
        const log = logEntry as IntentFundedLog
        // Validate the log to ensure it is an IntentFunded event we care about
        if (opts?.doValidation) {
          const isValidLog = await this.isOurIntent(log)
          if (!isValidLog) {
            continue
          }
        }

        log.sourceChainID = BigInt(source.chainID)
        log.sourceNetwork = source.network as Network

        // bigint as it can't serialize to JSON
        const intentFunded = log
        const intentHash = intentFunded.args.intentHash

        const jobId = getIntentJobId('watch-intent-funded', intentHash, intentFunded.logIndex)

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `addJob: watch intent funded`,
            properties: { intentFunded, jobId },
          }),
        )

        // Add to db
        await this.addIntentFundedEvent(intentFunded)

        try {
          // Add to processing queue
          await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.validate_intent, intentHash, {
            jobId,
            ...this.watchJobConfig,
          })

          // Track successful job addition
          this.ecoAnalytics.trackWatchIntentFundedJobQueued(intentFunded, jobId, source)
        } catch (error) {
          // Track job queue failure with complete context
          this.ecoAnalytics.trackWatchJobQueueError(
            error,
            ERROR_EVENTS.INTENT_FUNDED_JOB_QUEUE_FAILED,
            {
              intent: intentFunded,
              intentHash,
              jobId,
              source,
              transactionHash: intentFunded.transactionHash,
              logIndex: intentFunded.logIndex,
            },
          )
          throw error
        }
      }
    }
  }

  async addIntentFundedEvent(addIntentFundedEvent: IntentFundedLog): Promise<void> {
    try {
      // Check db if the intent is already filled
      await this.intentFundedEventRepository.addEvent(addIntentFundedEvent)
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in addIntentFundedEvent ${addIntentFundedEvent.transactionHash}`,
          properties: {
            intentHash: addIntentFundedEvent.transactionHash,
            error: ex instanceof Error ? ex.message : String(ex),
          },
        }),
      )

      // Track database error
      this.ecoAnalytics.trackError(ERROR_EVENTS.WATCH_INTENT_FUNDED_DB_ERROR, ex, {
        addIntentFundedEvent,
        operation: 'addIntentFundedEvent',
        transactionHash: addIntentFundedEvent.transactionHash,
      })
    }
  }

  /**
   * Returns the last recorded transaction for a source intent contract.
   *
   * @param sourceChainID the sourceChainID to get the last recorded transaction for
   * @returns
   */
  async getLastRecordedTx(sourceChainID: bigint): Promise<IntentFundedEventModel | undefined> {
    return this.intentFundedEventRepository.getLastRecordedTx(sourceChainID)
  }
}
