import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { JobsOptions, Queue } from 'bullmq'
import { MultichainPublicClientService } from '../../transaction/multichain-public-client.service'
import { Log, PublicClient, WatchContractEventReturnType } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoError } from '@/common/errors/eco-error'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

/**
 * This service subscribes has hooks for subscribing and unsubscribing to a contract event.
 */
@Injectable()
export abstract class WatchEventService<T extends { chainID: number }>
  implements OnApplicationBootstrap, OnModuleDestroy
{
  protected logger: Logger
  protected unwatch: Record<string, WatchContractEventReturnType> = {}
  protected watchJobConfig: JobsOptions

  constructor(
    protected readonly queue: Queue,
    protected readonly publicClientService: MultichainPublicClientService,
    protected readonly ecoConfigService: EcoConfigService,
    protected readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  async onModuleInit() {
    this.watchJobConfig = this.ecoConfigService.getRedis().jobs.watchJobConfig
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

  abstract addJob(source: T, opts?: { doValidation?: boolean }): (logs: Log[]) => Promise<void>

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

        // Track unsubscribe error with analytics
        if (this.ecoAnalytics) {
          this.ecoAnalytics.trackError(ANALYTICS_EVENTS.WATCH.UNSUBSCRIBE_ERROR, e, {
            operation: 'unsubscribe_all',
            service: this.constructor.name,
          })
        }
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

    // Track error occurrence if analytics service is available
    if (this.ecoAnalytics) {
      this.ecoAnalytics.trackWatchErrorOccurred(error, this.constructor.name, contract)
    }

    //reset the filters as they might have expired or we might have been moved to a new node
    //https://support.quicknode.com/hc/en-us/articles/10838914856977-Error-code-32000-message-filter-not-found

    // Track error recovery start
    if (this.ecoAnalytics) {
      this.ecoAnalytics.trackWatchErrorRecoveryStarted(this.constructor.name, contract)
    }

    try {
      await this.unsubscribeFrom(contract.chainID)
      await this.subscribeTo(client, contract)

      // Track successful recovery
      if (this.ecoAnalytics) {
        this.ecoAnalytics.trackWatchErrorRecoverySuccess(this.constructor.name, contract)
      }
    } catch (recoveryError) {
      // Track recovery failure
      if (this.ecoAnalytics) {
        this.ecoAnalytics.trackWatchErrorRecoveryFailed(
          recoveryError,
          this.constructor.name,
          contract,
        )
      }
      throw recoveryError
    }
  }

  /**
   * Process a batch of logs resiliently, ensuring a single failure does not halt the batch.
   * Logs a concise failure summary when any items fail.
   */
  protected async processLogsResiliently<L>(
    logs: L[],
    handleOne: (log: L) => Promise<void>,
    summaryLabel: string,
  ): Promise<void> {
    const results = await Promise.allSettled(logs.map((log) => handleOne(log)))
    const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    if (failures.length > 0) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `${summaryLabel}: ${failures.length}/${logs.length} jobs failed to be added to queue`,
          properties: {
            failures: failures.map((f) =>
              f.reason instanceof Error ? f.reason.message : String(f.reason),
            ),
          },
        }),
      )
    }
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

        // Track unsubscribe error with analytics
        if (this.ecoAnalytics) {
          this.ecoAnalytics.trackError(ANALYTICS_EVENTS.WATCH.UNSUBSCRIBE_FROM_ERROR, e, {
            operation: 'unsubscribe_from_chain',
            service: this.constructor.name,
            chainID,
          })
        }
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
