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
import { IIntentSourceAbi } from '@/utils/IIntentSource'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import * as BigIntSerializer from '@/common/utils/serialize'
import { getVmType, VmType } from '@/eco-configs/eco-config.types'
import { Connection, PublicKey, Commitment } from '@solana/web3.js'
import * as anchor from "@coral-xyz/anchor";
import { EcoAnalyticsService } from '@/analytics'
import { ERROR_EVENTS } from '@/analytics/events.constants'

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
        const vmType = getVmType(source.chainID)
      
        if (vmType === VmType.EVM) {
          const client = await this.publicClientService.getClient(source.chainID)
          await this.subscribeTo(client, source)
        } else if (vmType === VmType.SVM) {
          await this.subscribeToSvm(source)
        } else {
          throw new Error(`Unsupported VM type for chain ${source.chainID}`)
        }
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
      abi: IIntentSourceAbi,
      eventName: 'IntentPublished',
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


    const connection: Connection = await this.svmClientService.getConnection(source.chainID);

    const abortController = new AbortController()
    
    // Use web3.js account subscription
    this.trackAccountChanges(connection, source, abortController.signal)

    // Store unsubscribe function
    this.unwatch[source.chainID] = () => {
      abortController.abort()
    }
  }

  private async trackAccountChanges(connection: Connection, source: IntentSource, abortSignal: AbortSignal) {
    const portalIdl = require('@/solana/program/portal.json')
    const coder       = new anchor.BorshCoder(portalIdl);              // understands the IDL
    const parser      = new anchor.EventParser(new PublicKey(source.sourceAddress), coder); 
    try {
      const publicKey = new PublicKey(source.sourceAddress)
      
      const subscriptionId = connection.onLogs(
        publicKey,
        ({logs, signature}, context) => {
          try { 
            for (const ev of parser.parseLogs(logs)) { 
              if (ev.name !== "IntentPublished") continue;

              const {
                intent_hash,           // Uint8Array(32)
                destination,          // anchor.BN
                route,                // Uint8Array
                reward,               // whatever `Reward` expands to in your IDL
              } = ev.data;

              this.logger.debug(
                EcoLogMessage.fromDefault({
                  message: `SVM Publish instruction detected`,
                  properties: {
                    slot: context.slot, 
                    chainID: source.chainID,
                    address: source.sourceAddress,
                  },
                }),
              )

              const solanaLog = {
                transactionHash: signature,
                logIndex: 0,
                removed: false,
                blockHash: signature,
                transactionIndex: 0,
                blockNumber: BigInt(context.slot),
                sourceChainID: BigInt(source.chainID),
                sourceNetwork: source.network,
                args: {
                  hash: `0x${Buffer.from(intent_hash[0]).toString('hex')}` as `0x${string}`,
                },
                data: ev.data,
                topics: [],
                address: source.sourceAddress,
              };

              this.addJob(source)([solanaLog as any]).catch(error => {
                this.logger.error(
                  EcoLogMessage.fromDefault({
                    message: `SVM job processing error`,
                  }),
                )
              })
            }
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
        },
        'confirmed'
      )

      // Handle abortion
      abortSignal.addEventListener('abort', () => {
        connection.removeOnLogsListener(subscriptionId)
      })

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
          createIntent.args.intentHash,
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
