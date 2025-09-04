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
import { getVmType, VmType } from '@/eco-configs/eco-config.types'

import { Connection, PublicKey } from '@solana/web3.js'
import { SvmMultichainClientService } from '@/transaction/svm-multichain-client.service'

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
    private readonly svmClientService: SvmMultichainClientService,
    private createIntentService: CreateIntentService,
    protected readonly ecoConfigService: EcoConfigService,
  ) {
    super(intentQueue, publicClientService, ecoConfigService)
  }

  /**
   * Subscribes to all IntentSource contracts for IntentFunded events. It subscribes on all supported chains
   * filtering on the prover addresses and destination chain ids. It loads a mapping of the unsubscribe events to
   * call {@link onModuleDestroy} to close the clients.
   */
  async subscribe(): Promise<void> {
    const subscribeTasks = this.ecoConfigService.getIntentSources().map(async (source) => {
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
        message: `watch intent funded: subscribeToSource (EVM)`,
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
      eventName: 'IntentFunded',
      args: {
        // // restrict by acceptable chains, chain ids must be bigints
        // _destinationChain: solverSupportedChains,
        prover: source.provers as `0x${string}`[],
      },
      onLogs: async (logs: Log[]): Promise<void> => {
        await this.addJob(source, { doValidation: true })(logs)
      },
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

    const connection = await this.svmClientService.getConnection(source.chainID)

    // Track account changes using connection
    const subscriptionId = this.trackAccountChanges(connection, source)

    // Store unsubscribe function
    this.unwatch[source.chainID] = () => {
      if (subscriptionId !== null) {
        connection.removeAccountChangeListener(subscriptionId)
      }
    }
  }

  private trackAccountChanges(connection: Connection, source: IntentSource): number | null {
    try {
      const publicKey = new PublicKey(source.sourceAddress)

      const subscriptionId = connection.onAccountChange(
        publicKey,
        (accountInfo, context) => {
          try {
            const { slot } = context

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

            console.log('SVM accountInfo', accountInfo)
            console.log('SVM context', context)

            // Create synthetic log for SVM events
            const svmLog: Log = {
              address: source.sourceAddress as `0x${string}`,
              blockHash: ('0x' + slot.toString(16).padStart(64, '0')) as `0x${string}`,
              blockNumber: BigInt(slot),
              data: accountInfo
                ? (('0x' + Buffer.from(accountInfo.data).toString('hex')) as `0x${string}`)
                : '0x',
              logIndex: 0,
              removed: false,
              topics: [
                ('0x' +
                  Buffer.from('IntentFunded').toString('hex').padStart(64, '0')) as `0x${string}`,
              ],
              transactionHash: ('0x' + slot.toString(16).padStart(64, '0')) as `0x${string}`,
              transactionIndex: 0,
            }

            this.addJob(source, { doValidation: false })([svmLog])
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
        'confirmed',
      )

      return subscriptionId
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `SVM subscription error`,
          properties: {
            error: error.message,
            chainID: source.chainID,
          },
        }),
      )
      return null
    }
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
      for (const log of logs) {
        // Validate the log to ensure it is an IntentFunded event we care about
        if (opts?.doValidation) {
          const isValidLog = await this.isOurIntent(log)
          if (!isValidLog) {
            continue
          }
        }

        // Convert log to IntentFundedLog format
        const intentFunded = {
          ...log,
          sourceChainID: BigInt(source.chainID),
          sourceNetwork: source.network,
          args: log.args || {
            intentHash:
              log.topics[1] || '0x0000000000000000000000000000000000000000000000000000000000000000',
            // Add other args as needed based on the event structure
          },
        } as IntentFundedLog

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

        // Add to processing queue
        await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.validate_intent, intentHash, {
          jobId,
          ...this.intentJobConfig,
        })
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
