import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { getWatchJobId } from '@/common/utils/strings'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { WithdrawalLog } from '@/contracts/intent-source'
import { Log, PublicClient } from 'viem'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import * as BigIntSerializer from '@/common/utils/serialize'

/**
 * This service subscribes to IntentSource contracts for Withdrawal events. It subscribes on all
 * supported chains and addresses. When an event is emitted, it processes the withdrawal event
 * and adds it to the intent queue for updating the intent status to WITHDRAWN.
 */
@Injectable()
export class WatchWithdrawalService extends WatchEventService<IntentSource> {
  protected logger = new Logger(WatchWithdrawalService.name)

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) protected readonly intentQueue: Queue,
    protected readonly publicClientService: MultichainPublicClientService,
    protected readonly ecoConfigService: EcoConfigService,
  ) {
    super(intentQueue, publicClientService, ecoConfigService)
  }

  /**
   * Subscribes to all IntentSource contracts for Withdrawal events. It subscribes on all supported chains
   * and filters for withdrawal events. It loads a mapping of the unsubscribe events to
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
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch withdrawal: unsubscribe`,
      }),
    )
  }

  async subscribeTo(client: PublicClient, source: IntentSource) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch withdrawal: subscribeToSource`,
        properties: {
          source,
        },
      }),
    )

    this.unwatch[source.chainID] = [
      client.watchContractEvent({
        onError: async (error) => {
          await this.onError(error, client, source)
        },
        address: source.sourceAddress,
        abi: IntentSourceAbi,
        eventName: 'Withdrawal',
        // No specific args filtering needed for withdrawals - we want all withdrawal events
        onLogs: this.addJob(source),
      }),
    ]
  }

  addJob(source: IntentSource): (logs: Log[]) => Promise<void> {
    return async (logs: WithdrawalLog[]) => {
      for (const log of logs) {
        log.sourceChainID = BigInt(source.chainID)
        log.sourceNetwork = source.network

        // bigint as it can't serialize to JSON
        const withdrawal = BigIntSerializer.serialize(log)
        const jobId = getWatchJobId('watch-withdrawal', withdrawal.args.hash, withdrawal.logIndex)

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `watch withdrawal`,
            properties: {
              withdrawal,
              jobId,
              intentHash: withdrawal.args.hash,
              recipient: withdrawal.args.recipient,
            },
          }),
        )

        // add to processing queue
        //TODO update this to batching
        await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.withdrawal, withdrawal, {
          jobId,
          ...this.watchJobConfig,
        })
      }
    }
  }
}
