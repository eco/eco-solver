import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { JobsOptions, Queue } from 'bullmq'
import { MultichainPublicClientService } from '../../transaction/multichain-public-client.service'
import { Log, PublicClient, WatchContractEventReturnType } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoError } from '@/common/errors/eco-error'

/**
 * This service subscribes has hooks for subscribing and unsubscribing to a contract event.
 */
@Injectable()
export abstract class WatchEventService<T extends { chainID: number }>
  implements OnApplicationBootstrap, OnModuleDestroy
{
  protected logger: Logger
  protected intentJobConfig: JobsOptions
  protected unwatch: Record<string, WatchContractEventReturnType> = {}

  constructor(
    protected readonly queue: Queue,
    protected readonly publicClientService: MultichainPublicClientService,
    protected readonly ecoConfigService: EcoConfigService,
  ) {}

  async onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
  }

  async onApplicationBootstrap() {
    await this.subscribe()
  }

  async onModuleDestroy() {
    // close all clients
    this.unsubscribe()
  }

  /**
   * Subscribes to the events. It loads a mapping of the unsubscribe events to
   * call {@link onModuleDestroy} to close the clients.
   */
  abstract subscribe(): Promise<void>

  /**
   * Subscribes to a contract on a specific chain
   * @param client the client to subscribe to
   * @param contract the contract to subscribe to
   */
  abstract subscribeTo(client: PublicClient, contract: T): Promise<void>

  abstract addJob(source: T): (logs: Log[]) => Promise<void>

  /**
   * Unsubscribes from all events. It closes all clients in {@link onModuleDestroy}
   */
  async unsubscribe(): Promise<void> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `watch-event: unsubscribe`,
      }),
    )
    Object.values(this.unwatch).forEach((unwatch) => {
      try {
        unwatch()
      } catch (e) {
        this.logger.error(
          EcoLogMessage.withError({
            message: `watch-event: unsubscribe`,
            error: EcoError.WatchEventUnsubscribeError,
            properties: {
              errorPassed: e,
            },
          }),
        )
      }
    })
  }

  async onError(error: any, client: PublicClient, contract: T) {
    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `rpc client error`,
        properties: {
          error,
        },
      }),
    )
    //reset the filters as they might have expired or we might have been moved to a new node
    //https://support.quicknode.com/hc/en-us/articles/10838914856977-Error-code-32000-message-filter-not-found
    await this.unsubscribeFrom(contract.chainID)
    await this.subscribeTo(client, contract)
  }

  /**
   * Unsubscribes from a specific chain
   * @param chainID the chain id to unsubscribe from
   */
  async unsubscribeFrom(chainID: number) {
    if (this.unwatch[chainID]) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `watch-event: unsubscribeFrom`,
          properties: {
            chainID,
          },
        }),
      )
      try {
        this.unwatch[chainID]()
      } catch (e) {
        this.logger.error(
          EcoLogMessage.withError({
            message: `watch-event: unsubscribeFrom`,
            error: EcoError.WatchEventUnsubscribeFromError(chainID),
            properties: {
              chainID,
              errorPassed: e,
            },
          }),
        )
      }
    } else {
      this.logger.error(
        EcoLogMessage.withError({
          message: `watch event: unsubscribeFrom`,
          error: EcoError.WatchEventNoUnsubscribeError(chainID),
          properties: {
            chainID,
          },
        }),
      )
    }
  }
}
