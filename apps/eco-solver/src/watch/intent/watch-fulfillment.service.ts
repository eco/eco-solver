import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigService } from '@libs/solver-config'
import { Solver } from '@libs/solver-config'
import { Queue } from 'bullmq'
import { QUEUES } from '@eco-solver/common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { getIntentJobId } from '@eco-solver/common/utils/strings'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service'
import { PublicClient, zeroHash } from 'viem'
import { convertBigIntsToStrings } from '@eco-solver/common/viem/utils'
import { entries } from 'lodash'
import { InboxAbi } from '@eco-foundation/routes-ts'
import { WatchEventService } from '@eco-solver/watch/intent/watch-event.service'
import { FulfillmentLog } from '@eco-solver/contracts/inbox'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { ERROR_EVENTS } from '@eco-solver/analytics/events.constants'

/**
 * This service subscribes to Inbox contracts for Fulfillment events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, adds the event
 * to the queue to update the intent in the database.
 */
@Injectable()
export class WatchFulfillmentService extends WatchEventService<any> {
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
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch fulfillment event: subscribeToFulfillment`,
        properties: {
          solver,
        },
      }),
    )

    const sourceChains = this.getSupportedChains()
    this.unwatch[solver.chainID] = client.watchContractEvent({
      address: solver.inboxAddress,
      abi: InboxAbi,
      eventName: 'Fulfillment',
      strict: true,
      args: {
        // restrict by acceptable chains, chain ids must be bigints
        _sourceChainID: sourceChains,
      },
      onLogs: this.addJob(solver),
      onError: (error) => this.onError(error, client, solver),
    })
  }

  addJob(solver?: Solver) {
    return async (logs: FulfillmentLog[]) => {
      // Track batch of fulfillment events detected
      if (logs.length > 0 && solver) {
        this.ecoAnalytics.trackWatchFulfillmentEventsDetected(logs.length, solver)
      }

      for (const log of logs) {
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
          throw error
        }
      }
    }
  }
}
