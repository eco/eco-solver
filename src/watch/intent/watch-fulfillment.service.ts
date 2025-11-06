import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { getIntentJobId } from '@/common/utils/strings'
import { Solver } from '@/eco-configs/eco-config.types'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { Log, PublicClient, zeroHash } from 'viem'
import { convertBigIntsToStrings } from '@/common/viem/utils'
import { entries } from 'lodash'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import { FulfillmentLog } from '@/contracts/inbox'
import { EcoAnalyticsService } from '@/analytics'
import { ERROR_EVENTS } from '@/analytics/events.constants'
import { portalAbi } from '@/contracts/v2-abi/Portal'

/**
 * This service subscribes to Inbox contracts for Fulfillment events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, adds the event
 * to the queue to update the intent in the database.
 */
@Injectable()
export class WatchFulfillmentService extends WatchEventService<Solver> {
  protected logger = new Logger(WatchFulfillmentService.name)

  constructor(
    @InjectQueue(QUEUES.INBOX.queue) protected readonly inboxQueue: Queue,
    protected readonly publicClientService: MultichainPublicClientService,
    protected readonly ecoConfigService: EcoConfigService,
    protected readonly ecoAnalytics: EcoAnalyticsService,
  ) {
    super(inboxQueue, publicClientService, ecoConfigService, ecoAnalytics)
  }

  /**
   * Subscribes to all Inbox constacts for Fulfillment events. It loads a mapping of the unsubscribe events to
   * call {@link onModuleDestroy} to close the clients.
   */
  async subscribe(): Promise<void> {
    const subscribeTasks = entries(this.ecoConfigService.getSolvers()).map(async ([, solver]) => {
      const client = await this.publicClientService.getClient(solver.chainID)
      await this.subscribeTo(client, solver)
    })
    await Promise.all(subscribeTasks)
  }

  async unsubscribe() {
    super.unsubscribe()
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch fulfillment: unsubscribe`,
      }),
    )
  }

  /**
   * Checks to see what networks we have intent sources for
   * @returns the supported chains for the event
   */
  getSupportedChains(): bigint[] {
    return this.ecoConfigService.getIntentSources().map((source) => BigInt(source.chainID))
  }

  async subscribeTo(client: PublicClient, solver: Solver) {
    const chainID = Number(solver.chainID)
    const fromBlock = this.getNextFromBlock(chainID)
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch fulfillment event: subscribeToFulfillment`,
        properties: {
          solver,
        },
      }),
    )

    this.unwatch[chainID] = client.watchContractEvent({
      address: solver.inboxAddress,
      abi: portalAbi,
      eventName: 'IntentFulfilled',
      strict: true,
      fromBlock,
      onLogs: this.addJob(solver),
      onError: (error) => this.onError(error, client, solver),
      pollingInterval: this.getPollingInterval(solver.chainID),
    })
  }

  addJob(solver?: Solver) {
    return async (logs: FulfillmentLog[]) => {
      // Track batch of fulfillment events detected
      if (logs.length > 0 && solver) {
        this.ecoAnalytics.trackWatchFulfillmentEventsDetected(logs.length, solver)
      }

      // Track the highest successfully processed block and the earliest failed block.
      // We will only advance the cursor to the last safe block that guarantees no skipped logs.
      const chainIDNum = solver ? Number(solver.chainID) : undefined
      let maxSuccessBlock: bigint | undefined
      let minFailedBlock: bigint | undefined

      await this.processLogsResiliently(
        logs,
        async (log) => {
          const blockNum = typeof log.blockNumber === 'bigint' ? log.blockNumber : undefined
          // bigint as it can't serialize to JSON
          const fulfillment = convertBigIntsToStrings(log)
          const jobId = getIntentJobId(
            'watch-fulfillement',
            fulfillment.args._hash ?? zeroHash,
            fulfillment.logIndex ?? 0,
          )
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: `watch fulfillment`,
              properties: {
                fulfillment,
                jobId,
              },
            }),
          )

          try {
            // add to processing queue
            await this.inboxQueue.add(QUEUES.INBOX.jobs.fulfillment, fulfillment, {
              jobId,
              ...this.watchJobConfig,
            })

            // Track successful job addition
            if (solver) {
              this.ecoAnalytics.trackWatchFulfillmentJobQueued(fulfillment, jobId, solver)
            }
          } catch (error) {
            // Track job queue failure with complete context
            this.ecoAnalytics.trackWatchJobQueueError(
              error,
              ERROR_EVENTS.FULFILLMENT_JOB_QUEUE_FAILED,
              {
                fulfillment,
                jobId,
                solver,
                transactionHash: fulfillment.transactionHash,
                logIndex: fulfillment.logIndex,
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
        'watch fulfillment',
      )

      if (chainIDNum !== undefined) {
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
  }

  protected override async fetchBackfillLogs(
    client: PublicClient,
    solver: Solver,
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<Log[]> {
    const MAX_BACKFILL_BLOCK_RANGE = 10_000n
    let effectiveFromBlock = fromBlock
    if (toBlock - fromBlock > MAX_BACKFILL_BLOCK_RANGE) {
      effectiveFromBlock =
        toBlock > MAX_BACKFILL_BLOCK_RANGE ? toBlock - MAX_BACKFILL_BLOCK_RANGE : 0n
    }

    const logs = await client.getContractEvents({
      address: solver.inboxAddress,
      abi: portalAbi,
      eventName: 'IntentFulfilled',
      strict: true,
      fromBlock: effectiveFromBlock,
      toBlock,
    })

    return logs as Log[]
  }
}
