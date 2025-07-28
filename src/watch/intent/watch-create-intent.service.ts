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
import { Connection, PublicKey, Commitment } from '@solana/web3.js'
import * as anchor from "@coral-xyz/anchor";

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
    const portalIdl = require('src/solana/program/portal.json')
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

              console.log("JUSTLOGGING: ev.data", ev);

              const solanaLog = {
                transactionHash: signature,
                slot: context.slot,
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
