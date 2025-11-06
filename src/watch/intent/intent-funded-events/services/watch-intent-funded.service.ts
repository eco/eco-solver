import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
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

/**
 * This service subscribes to IntentSource contracts for IntentFunded events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, it mutates the event log, and then
 * adds it intent queue for processing.
 */
const MAX_BACKFILL_BLOCK_RANGE = 10_000n

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
    const chainID = Number(source.chainID)
    const fromBlock = this.getNextFromBlock(chainID)
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch intent funded: subscribeToSource`,
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
      eventName: 'IntentFunded',
      fromBlock,
      onLogs: async (logs: Log[]): Promise<void> => {
        try {
          // Track intent funded events detected
          if (logs.length > 0) {
            this.ecoAnalytics.trackWatchIntentFundedEventsDetected(logs.length, source)
          }
          await this.addJob(source, { doValidation: true })(logs)
        } catch (error) {
          this.logger.error(
            EcoLogMessage.withError({
              message: 'watch intent-funded onLogs handler error',
              error,
            }),
          )
        }
      },
      pollingInterval: this.getPollingInterval(source.chainID),
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
    return async (logs: IntentFundedLog[]) => {
      // Track the highest successfully processed block and the earliest failed block.
      // We will only advance the cursor to the last safe block that guarantees no skipped logs.
      const chainIDNum = Number(source.chainID)
      let maxSuccessBlock: bigint | undefined
      let minFailedBlock: bigint | undefined

      await this.processLogsResiliently(
        logs,
        async (log) => {
          const blockNum = typeof log.blockNumber === 'bigint' ? log.blockNumber : undefined
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
        'watch intent-funded',
      )

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
            error: ex.message,
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

    const logs = await client.getContractEvents({
      address: source.sourceAddress,
      abi: portalAbi,
      eventName: 'IntentFunded',
      strict: true,
      fromBlock: effectiveFromBlock,
      toBlock,
    })

    return logs as Log[]
  }
}
