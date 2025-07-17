import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { InjectQueue } from '@nestjs/bullmq'
import { getIntentJobId } from '@/common/utils/strings'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { SvmMultichainClientService } from '@/transaction/svm-multichain-client.service'
import { IntentCreatedLog } from '@/contracts'
import { Log, PublicClient } from 'viem'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import * as BigIntSerializer from '@/common/utils/serialize'
import { getVMType, VMType } from '@/eco-configs/eco-config.types'
import { Address as SvmAddress, RpcSubscriptions, SolanaRpcSubscriptionsApi } from '@solana/kit'

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
    private readonly svmClientService: SvmMultichainClientService,
    protected readonly ecoConfigService: EcoConfigService,
  ) {
    super(intentQueue, publicClientService, ecoConfigService)
  }

  /**
   * Subscribes to all IntentSource contracts for IntentCreated events. It subscribes on all supported chains
   * filtering on the prover addresses and destination chain ids. It loads a mapping of the unsubscribe events to
   * call {@link onModuleDestroy} to close the clients.
   */
  async subscribe(): Promise<void> {
    const subscribeTasks = this.ecoConfigService.getIntentSources().map(async (source) => {
      const vmType = getVMType(source.chainID)
      
      if (vmType === VMType.EVM) {
        const client = await this.publicClientService.getClient(source.chainID)
        await this.subscribeTo(client, source)
      } else if (vmType === VMType.SVM) {
        await this.subscribeToSvm(source)
      } else {
        throw new Error(`Unsupported VM type for chain ${source.chainID}`)
      }
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
        message: `watch create intent: subscribeToSource (EVM)`,
        properties: {
          source,
        },
      }),
    )

    this.unwatch[source.chainID] = client.watchContractEvent({
      onError: async (error) => {
        await this.onError(error, client, source)
      },
      address: source.sourceAddress as `0x${string}`,
      abi: IntentSourceAbi,
      eventName: 'IntentCreated',
      args: {
        // // restrict by acceptable chains, chain ids must be bigints
        // _destinationChain: solverSupportedChains,
        prover: source.provers as `0x${string}`[],
      },
      onLogs: this.addJob(source),
    })
  }

  async subscribeToSvm(source: IntentSource) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch intent funded: subscribeToSource (SVM)`,
        properties: {
          source,
        },
      }),
    )

    const rpc: RpcSubscriptions<SolanaRpcSubscriptionsApi> = await this.svmClientService.getRpcSubscriptions(source.chainID);
    const abortController = new AbortController()
    
    // Use async iteration pattern for account notifications
    this.trackAccountChanges(rpc, source, abortController.signal)

    // Store unsubscribe function
    this.unwatch[source.chainID] = () => {
      abortController.abort()
    }
  }

  private async trackAccountChanges(rpc: RpcSubscriptions<SolanaRpcSubscriptionsApi>, source: IntentSource, abortSignal: AbortSignal) {
    try {
      const accountNotifications = await rpc
        .accountNotifications(source.sourceAddress as SvmAddress, { commitment: 'confirmed' })
        .subscribe({ abortSignal })

      for await (const notification of accountNotifications) {
        try {
          const { slot } = notification.context
          const accountInfo = notification.value
          
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: `SVM account change detected`,
              properties: {
                slot,
                chainID: source.chainID,
                address: source.sourceAddress,
              },
            }),
          )

          console.log("SVM accountInfo", accountInfo);
          console.log("SVM notification", notification);

          // Create synthetic log for SVM events
          const svmLog: Log = {
            address: source.sourceAddress as `0x${string}`,
            blockHash: '0x' + slot.toString(16).padStart(64, '0') as `0x${string}`,
            blockNumber: BigInt(slot),
            data: accountInfo ? '0x' + Buffer.from(accountInfo.data).toString('hex') as `0x${string}` : '0x',
            logIndex: 0,
            removed: false,
            topics: ['0x' + Buffer.from('IntentFunded').toString('hex').padStart(64, '0') as `0x${string}`],
            transactionHash: '0x' + slot.toString(16).padStart(64, '0') as `0x${string}`,
            transactionIndex: 0,
          }

          await this.addJob(source)([svmLog])
        } catch (error) {
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: `SVM notification processing error`,
              properties: {
                error: error.message,
                chainID: source.chainID,
              },
            }),
          )
        }
      }
    } catch (error) {
      if (!abortSignal.aborted) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `SVM subscription error`,
            properties: {
              error: error.message,
              chainID: source.chainID,
            },
          }),
        )
      }
    }
  }

  addJob(source: IntentSource): (logs: Log[]) => Promise<void> {
    return async (logs: IntentCreatedLog[]) => {
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
        // add to processing queue
        await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.create_intent, createIntent, {
          jobId,
          ...this.intentJobConfig,
        })
      }
    }
  }
}
