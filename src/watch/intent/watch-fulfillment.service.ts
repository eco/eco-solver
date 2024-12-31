import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { getIntentJobId } from '@/common/utils/strings'
import { Solver } from '@/eco-configs/eco-config.types'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { PublicClient, zeroHash } from 'viem'
import { convertBigIntsToStrings } from '@/common/viem/utils'
import { entries } from 'lodash'
import { InboxAbi } from '@eco-foundation/routes-ts'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import { FulfillmentLog } from '@/contracts/inbox'

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
  ) {
    super(inboxQueue, publicClientService, ecoConfigService)
  }

  /**
   * Subscribes to all Inbox constacts for Fulfillment events. It loads a mapping of the unsubscribe events to
   * call {@link onModuleDestroy} to close the clients.
   */
  async subscribe(): Promise<void> {
    const subscribeTasks = entries(this.ecoConfigService.getSolvers()).map(async ([, solver]) => {
      const client = await this.publicClientService.getClient(solver.chainID)
      await this.subscribeTo(client, solver, this.getSupportedChains())
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

  async subscribeTo(client: PublicClient, solver: Solver, souceChains: bigint[]) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch fulfillment event: subscribeToFulfillment`,
        properties: {
          solver,
        },
      }),
    )
    this.unwatch[solver.chainID] = client.watchContractEvent({
      onError: async (error) => {
        await this.onError(error, client, solver)
      },
      address: solver.solverAddress,
      abi: InboxAbi,
      eventName: 'Fulfillment',
      args: {
        // restrict by acceptable chains, chain ids must be bigints
        _sourceChainID: souceChains,
      },
      onLogs: this.addJob(),
    })
  }

  addJob() {
    return async (logs: FulfillmentLog[]) => {
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
          // add to processing queue
          await this.inboxQueue.add(QUEUES.INBOX.jobs.fulfillement, fulfillment, {
            jobId,
            ...this.intentJobConfig,
          }),
        )
      }
    }
  }
}
