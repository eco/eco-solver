import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoAnalyticsService } from '@/analytics'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getIntentJobId } from '@/common/utils/strings'
import { Hex, Log, PublicClient } from 'viem'
import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentProvenLog } from '@/contracts'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { IProverAbi } from '@eco-foundation/routes-ts'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { Network } from '@/common/alchemy/network'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import * as _ from 'lodash'

export interface Prover {
  network: Network
  chainID: number
  proverAddress: Hex
}

interface ProversForChain {
  network: Network
  chainID: number
  proverAddresses: Hex[]
}

/**
 * This service subscribes to Prover contracts for IntentProven events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, it mutates the event log, and then
 * adds it intent queue for processing.
 */
@Injectable()
export class WatchIntentProvenService extends WatchEventService<Prover> {
  protected logger = new Logger(WatchIntentProvenService.name)

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) protected readonly intentQueue: Queue,
    protected readonly publicClientService: MultichainPublicClientService,
    private createIntentService: CreateIntentService,
    protected readonly ecoAnalytics: EcoAnalyticsService,
    protected readonly ecoConfigService: EcoConfigService,
  ) {
    super(intentQueue, publicClientService, ecoConfigService, ecoAnalytics)
  }

  /**
   * Subscribes to all Prover contracts for IntentProven events. It subscribes on all supported chains
   * filtering on the prover addresses and destination chain ids. It loads a mapping of the unsubscribe events to
   * call {@link onModuleDestroy} to close the clients.
   */
  async subscribe(): Promise<void> {
    const intentSources = this.ecoConfigService.getIntentSources()
    const proversByChainID = this.groupProversByChain(intentSources)
    const subscribeTasks: Promise<void>[] = []

    for (const [chainIDStr, proversForChain] of Object.entries(proversByChainID)) {
      const chainID = Number(chainIDStr)

      if (_.isEmpty(proversForChain.proverAddresses)) {
        continue
      }

      const client = await this.publicClientService.getClient(chainID)

      for (const proverAddress of proversForChain.proverAddresses) {
        const prover: Prover = {
          network: proversForChain.network,
          chainID: proversForChain.chainID,
          proverAddress,
        }

        const subscribeTask = this.subscribeTo(client, prover)
        subscribeTasks.push(subscribeTask)
      }
    }

    await Promise.all(subscribeTasks)
  }

  /**
   * Unsubscribes from all Prover contracts. It closes all clients in {@link onModuleDestroy}
   */
  async unsubscribe() {
    super.unsubscribe()
  }

  async subscribeTo(client: PublicClient, prover: Prover) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch intent proven: subscribeTo`,
        properties: {
          prover,
        },
      }),
    )

    this.unwatch[this.makeUnwatchKey(prover)] = client.watchContractEvent({
      onError: async (error) => {
        await this.onError(error, client, prover)
      },
      address: prover.proverAddress,
      abi: IProverAbi,
      eventName: 'IntentProven',
      onLogs: async (logs: Log[]): Promise<void> => {
        await this.addJob(prover, { doValidation: true })(logs)
      },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async isOurIntent(log: IntentProvenLog): Promise<boolean> {
    const intentHash = log.args._hash
    const { error } = await this.createIntentService.getIntentForHash(intentHash)

    if (error) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `IntentProven event is not ours, skipping`,
          properties: {
            intentHash,
          },
        }),
      )
    }

    return !error
  }

  addJob(prover: Prover, opts?: { doValidation?: boolean }): (logs: Log[]) => Promise<void> {
    return async (logs: IntentProvenLog[]) => {
      for (const log of logs) {
        // Validate the log to ensure it is an IntentProven event we care about
        if (opts?.doValidation) {
          const isValidLog = await this.isOurIntent(log)
          if (!isValidLog) {
            continue
          }
        }

        const intentHash = log.args._hash
        const jobId = getIntentJobId('watch-intent-proven', intentHash, log.logIndex)

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `addJob: watch intent proven`,
            properties: {
              log,
              jobId,
            },
          }),
        )

        // Add to processing queue
        await this.intentQueue.add(
          QUEUES.SOURCE_INTENT.jobs.proven_intent,
          { intentHash },
          {
            jobId,
            ...this.watchJobConfig,
          },
        )
      }
    }
  }

  private groupProversByChain(intentSources: IntentSource[]): Record<number, ProversForChain> {
    return Object.fromEntries(
      intentSources.map((src) => [
        src.chainID,
        {
          network: src.network,
          chainID: src.chainID,
          proverAddresses: _.uniq(src.provers) as `0x${string}`[],
        },
      ]),
    )
  }

  private getProvers(intentSources: IntentSource[]): Prover[] {
    return intentSources.flatMap((src) =>
      _.uniq(src.provers).map((proverAddress) => ({
        network: src.network,
        chainID: src.chainID,
        proverAddress: proverAddress as `0x${string}`,
      })),
    )
  }

  private makeUnwatchKey(prover: Prover): string {
    return `${prover.chainID}-${prover.proverAddress}`
  }
}
