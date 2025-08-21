import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { JobsOptions, Queue } from 'bullmq'
import { MultichainPublicClientService } from '../../transaction/multichain-public-client.service'
import { Log, PublicClient, WatchContractEventReturnType } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoError } from '@/common/errors/eco-error'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

/**
 * This service has hooks for subscribing and unsubscribing to a contract event.
 */
@Injectable()
export abstract class WatchEventService<T extends { chainID: number }>
  implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
  protected readonly logger = new Logger(this.constructor.name)
  // Map each chainID to its active viem unwatch callback. Enables targeted teardown and avoids leaking references.
  protected unwatch: Record<number, WatchContractEventReturnType> = {}
  protected watchJobConfig: JobsOptions

  /**
   * Per-chain recovery guard and capped exponential backoff.
   * Prevents overlapping recoveries and reduces thrashing when RPC nodes flap.
   * No circuit breaker: further retries occur only when new errors arrive.
   */
  protected recoveryAttempts: Record<number, number> = {}
  protected recoveryInProgress: Record<number, boolean> = {}
  protected recoveryIgnoredAttempts: Record<number, number> = {}
  protected readonly recoveryBackoffBaseMs = 1_000
  protected readonly recoveryBackoffMaxMs = 30_000
  // Timestamp of last successful recovery per chain; used to decide when to reset attempts
  protected recoveryLastRecoveredAt: Record<number, number> = {}
  // If no errors occur for this period after a recovery, we reset attempts on the next error
  protected readonly recoveryStabilityWindowMs = 60_000

  constructor(
    protected readonly queue: Queue,
    protected readonly publicClientService: MultichainPublicClientService,
    protected readonly ecoConfigService: EcoConfigService,
    protected readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  /**
   * Load runtime configuration used by watch jobs from the central config service.
   */
  async onModuleInit() {
    this.watchJobConfig = this.ecoConfigService.getRedis().jobs.watchJobConfig
  }

  /**
   * Subscribe on bootstrap and await completion to ensure watchers are registered
   * before the application begins handling traffic.
   */
  async onApplicationBootstrap() {
    await this.subscribe()
  }

  async onModuleDestroy() {
    // Close all clients; awaiting ensures cleanup completes during shutdown.
    await this.unsubscribe()
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
    for (const [id, unwatch] of Object.entries(this.unwatch)) {
      // Best-effort cleanup: call the unwatch callback and remove the entry
      // to avoid stale references or duplicate listeners.
      try {
        unwatch()
        delete this.unwatch[Number(id)]
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
    }
  }

  /**
   * Recover from stream/client errors by re-establishing the subscription.
   * - Per-chain in-progress guard prevents overlapping recoveries.
   * - Capped exponential backoff smooths transient RPC failures.
   */
  async onError(error: any, client: PublicClient, contract: T) {
    // reset the filters as they might have expired or we might have been moved to a new node
    // https://support.quicknode.com/hc/en-us/articles/10838914856977-Error-code-32000-message-filter-not-found

    const chainID = contract.chainID

    // Prevent concurrent recoveries for the same chain
    if (this.recoveryInProgress[chainID]) {
      this.recoveryIgnoredAttempts[chainID] = (this.recoveryIgnoredAttempts[chainID] ?? 0) + 1
      return
    }

    this.recoveryInProgress[chainID] = true

    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `rpc client error`,
        properties: {
          error,
          ignoredAttempts: this.recoveryIgnoredAttempts[chainID] ?? 0,
        },
      }),
    )

    // Track error occurrence if analytics service is available
    if (this.ecoAnalytics) {
      this.ecoAnalytics.trackWatchErrorOccurred(error, this.constructor.name, {
        contract,
        ignoredAttempts: this.recoveryIgnoredAttempts[chainID] ?? 0,
      })
    }

    // Capped exponential backoff between attempts for this chain
    const now = Date.now()
    let attemptsSoFar = this.recoveryAttempts[chainID] ?? 0
    const lastRecoveredAt = this.recoveryLastRecoveredAt[chainID] ?? 0
    if (lastRecoveredAt && now - lastRecoveredAt >= this.recoveryStabilityWindowMs) {
      // Previous subscription has been stable long enough; reset backoff attempts.
      attemptsSoFar = 0
      this.recoveryAttempts[chainID] = 0
    }
    const nextAttempt = attemptsSoFar + 1
    // Optimistically bump attempts so that even if resubscribe succeeds but errors return quickly,
    // the subsequent backoff escalates until the subscription remains stable for the window.
    this.recoveryAttempts[chainID] = nextAttempt
    const delayMs = Math.min(
      this.recoveryBackoffBaseMs * 2 ** attemptsSoFar,
      this.recoveryBackoffMaxMs,
    )

    // Track error recovery start
    if (this.ecoAnalytics) {
      this.ecoAnalytics.trackWatchErrorRecoveryStarted(this.constructor.name, contract)
    }

    try {
      if (delayMs > 0) {
        await this.delay(delayMs)
      }

      // Filters may be invalid or node changed; refresh by tearing down and resubscribing.
      await this.unsubscribeFrom(chainID)
      await this.subscribeTo(client, contract)

      // Mark recovery time; attempts will reset only if we remain stable past the window
      this.recoveryLastRecoveredAt[chainID] = Date.now()

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

      // Persist attempt count and emit telemetry; future errors will retry with higher backoff.
      this.logger.warn(
        EcoLogMessage.withError({
          message: `watch-event: recovery failed, will retry with backoff`,
          error: recoveryError,
          properties: { chainID, attempts: nextAttempt, delayMs },
        }),
      )

      throw recoveryError
    } finally {
      this.recoveryInProgress[chainID] = false
      this.recoveryIgnoredAttempts[chainID] = 0
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
        delete this.unwatch[chainID]
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

  /**
   * Sleep helper used by backoff.
   */
  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
}
