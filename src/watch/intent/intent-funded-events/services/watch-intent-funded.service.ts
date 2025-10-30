import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { getIntentJobId } from '@/common/utils/strings'
import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentFundedEventModel } from '@/watch/intent/intent-funded-events/schemas/intent-funded-events.schema'
import { IntentFundedEventRepository } from '@/watch/intent/intent-funded-events/repositories/intent-funded-event.repository'
import { IntentFundedLog } from '@/contracts'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { Log, PublicClient } from 'viem'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import { EcoAnalyticsService } from '@/analytics'
import { ERROR_EVENTS } from '@/analytics/events.constants'
import { LogOperation, LogSubOperation } from '@/common/logging/decorators/log-operation.decorator'
import { LogContext } from '@/common/logging/decorators/log-context.decorator'
import { IntentOperationLogger } from '@/common/logging/loggers/intent-operation-logger'

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
  @LogOperation('intent_funded_subscription', IntentOperationLogger)
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
  @LogSubOperation('unsubscribe')
  async unsubscribe(): Promise<void> {
    super.unsubscribe()
  }

  @LogSubOperation('subscribe_to_source')
  async subscribeTo(
    @LogContext client: PublicClient,
    @LogContext source: IntentSource,
  ): Promise<void> {
    this.unwatch[source.chainID] = client.watchContractEvent({
      onError: async (error) => {
        await this.onError(error, client, source)
      },
      address: source.sourceAddress,
      abi: IntentSourceAbi,
      eventName: 'IntentFunded',
      onLogs: async (logs: Log[]): Promise<void> => {
        try {
          // Track intent funded events detected
          if (logs.length > 0) {
            this.ecoAnalytics.trackWatchIntentFundedEventsDetected(logs.length, source)
          }
          const addJobFunction = await this.addJob(source, { doValidation: true })
          await addJobFunction(logs)
        } catch (error) {
          this.logger.error('watch intent-funded onLogs handler error', {
            service: 'watch-intent-funded',
            operation: 'handle_logs',
            error: error.message,
            source: source.sourceAddress,
          })
        }
      },
    })
  }

  @LogSubOperation('validate_our_intent')
  private async isOurIntent(@LogContext log: IntentFundedLog): Promise<boolean> {
    /* Make sure it's one of ours. It might not be ours because:
     * .The intent was created by another solver, so won't be in our database.
     * .The intent was not even a gasless one! Remember, publishAndFund() *also* emits IntentFunded events,
     *  and those ones are not gasless intents.
     */
    const { error } = await this.createIntentService.getIntentForHash(log.args.intentHash)

    return !error
  }

  @LogSubOperation('process_intent_funded_logs')
  addJob(
    @LogContext source: IntentSource,
    opts?: { doValidation?: boolean },
  ): (logs: Log[]) => Promise<void> {
    return async (logs: IntentFundedLog[]) => {
      await this.processLogsResiliently(
        logs,
        async (log) => {
          // Validate the log to ensure it is an IntentFunded event we care about
          if (opts?.doValidation) {
            const isValidLog = await this.isOurIntent(log)
            if (!isValidLog) {
              return
            }
          }

          log.sourceChainID = BigInt(source.chainID)
          log.sourceNetwork = source.network

          // bigint as it can't serialize to JSON
          const intentFunded = log
          const intentHash = intentFunded.args.intentHash

          const jobId = getIntentJobId('watch-intent-funded', intentHash, intentFunded.logIndex)

          // Intent funded job creation context automatically captured by parent operation decorator

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
        },
        'watch intent-funded',
      )
    }
  }

  @LogSubOperation('add_intent_funded_event')
  async addIntentFundedEvent(@LogContext addIntentFundedEvent: IntentFundedLog): Promise<void> {
    try {
      // Check db if the intent is already filled
      await this.intentFundedEventRepository.addEvent(addIntentFundedEvent)
    } catch (ex) {
      // Track database error
      this.ecoAnalytics.trackError(ERROR_EVENTS.WATCH_INTENT_FUNDED_DB_ERROR, ex, {
        addIntentFundedEvent,
        operation: 'addIntentFundedEvent',
        transactionHash: addIntentFundedEvent.transactionHash,
      })
      throw ex
    }
  }

  /**
   * Returns the last recorded transaction for a source intent contract.
   *
   * @param sourceChainID the sourceChainID to get the last recorded transaction for
   * @returns
   */
  @LogSubOperation('get_last_recorded_tx')
  async getLastRecordedTx(
    @LogContext sourceChainID: bigint,
  ): Promise<IntentFundedEventModel | undefined> {
    return this.intentFundedEventRepository.getLastRecordedTx(sourceChainID)
  }
}
