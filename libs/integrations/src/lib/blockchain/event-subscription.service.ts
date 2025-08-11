import { Injectable, Logger } from '@nestjs/common'
import { PublicClient, WatchContractEventReturnType, Log, Abi } from 'viem'
import { EcoLogMessage, EcoError, ANALYTICS_EVENTS } from '@libs/shared'
import { EcoAnalyticsService } from '../analytics/eco-analytics.service'

export interface EventConfig {
  address: string
  abi: Abi
  eventName: string
  args?: Record<string, any>
  onLogs: (logs: Log[]) => Promise<void>
  onError?: (error: any) => Promise<void>
}

export interface SubscriptionManager {
  chainId: number
  unwatch: WatchContractEventReturnType
  config: EventConfig
}

@Injectable()
export class BlockchainEventSubscriptionService {
  private readonly logger = new Logger(BlockchainEventSubscriptionService.name)
  private readonly subscriptions = new Map<string, SubscriptionManager>()

  constructor(private readonly ecoAnalytics: EcoAnalyticsService) {}

  /**
   * Subscribe to contract events on a specific chain
   * @param client Viem public client for the chain
   * @param config Event subscription configuration
   * @returns Subscription key for management
   */
  async subscribeToContract<T>(
    client: PublicClient, 
    config: EventConfig,
    chainId: number
  ): Promise<string> {
    const subscriptionKey = this.generateSubscriptionKey(chainId, config)
    
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'subscribing to contract event',
        properties: { 
          chainId, 
          address: config.address, 
          eventName: config.eventName,
          subscriptionKey
        }
      })
    )

    try {
      const unwatch = client.watchContractEvent({
        address: config.address as `0x${string}`,
        abi: config.abi,
        eventName: config.eventName,
        args: config.args,
        onLogs: async (logs) => {
          try {
            await config.onLogs(logs)
            
            // Track successful event processing
            this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.BLOCKCHAIN.EVENT_PROCESSED, {
              chainId,
              eventName: config.eventName,
              logCount: logs.length,
              subscriptionKey
            })
          } catch (error) {
            this.logger.error(
              EcoLogMessage.withError({
                message: 'error processing contract logs',
                error: EcoError.getErrorObject(error),
                properties: { chainId, eventName: config.eventName, logCount: logs.length }
              })
            )

            // Track event processing error
            this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BLOCKCHAIN.EVENT_PROCESSING_ERROR, error, {
              chainId,
              eventName: config.eventName,
              logCount: logs.length,
              subscriptionKey
            })
          }
        },
        onError: async (error) => {
          await this.handleSubscriptionError(error, client, config, chainId, subscriptionKey)
        }
      })

      // Store subscription for management
      this.subscriptions.set(subscriptionKey, {
        chainId,
        unwatch,
        config
      })

      // Track successful subscription
      this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.BLOCKCHAIN.SUBSCRIPTION_CREATED, {
        chainId,
        eventName: config.eventName,
        address: config.address,
        subscriptionKey
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'successfully subscribed to contract event',
          properties: { chainId, eventName: config.eventName, subscriptionKey }
        })
      )

      return subscriptionKey
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to subscribe to contract event',
          error: EcoError.getErrorObject(error),
          properties: { chainId, eventName: config.eventName }
        })
      )

      // Track subscription failure
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BLOCKCHAIN.SUBSCRIPTION_FAILED, error, {
        chainId,
        eventName: config.eventName,
        address: config.address
      })

      throw error
    }
  }

  /**
   * Handle subscription errors with recovery logic
   * @param error The error that occurred
   * @param client The public client
   * @param config Event configuration
   * @param chainId Chain ID
   * @param subscriptionKey Subscription identifier
   */
  async handleSubscriptionError(
    error: any, 
    client: PublicClient, 
    config: EventConfig,
    chainId: number,
    subscriptionKey: string
  ): Promise<void> {
    this.logger.error(
      EcoLogMessage.withError({
        message: 'blockchain subscription error occurred',
        error: EcoError.getErrorObject(error),
        properties: { chainId, eventName: config.eventName, subscriptionKey }
      })
    )

    // Track error occurrence
    this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BLOCKCHAIN.SUBSCRIPTION_ERROR, error, {
      chainId,
      eventName: config.eventName,
      subscriptionKey,
      errorCode: error?.code,
      errorMessage: error?.message
    })

    // Call custom error handler if provided
    if (config.onError) {
      try {
        await config.onError(error)
      } catch (handlerError) {
        this.logger.error(
          EcoLogMessage.withError({
            message: 'error in custom error handler',
            error: EcoError.getErrorObject(handlerError),
            properties: { chainId, originalError: error }
          })
        )
      }
    }

    // Attempt recovery for known error patterns
    if (this.shouldAttemptRecovery(error)) {
      await this.attemptRecovery(client, config, chainId, subscriptionKey)
    }
  }

  /**
   * Unsubscribe from a specific contract event
   * @param subscriptionKey The subscription key to unsubscribe
   */
  async unsubscribeFromContract(subscriptionKey: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionKey)
    
    if (!subscription) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'attempted to unsubscribe from non-existent subscription',
          properties: { subscriptionKey }
        })
      )
      return
    }

    try {
      subscription.unwatch()
      this.subscriptions.delete(subscriptionKey)

      // Track successful unsubscription
      this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.BLOCKCHAIN.SUBSCRIPTION_REMOVED, {
        chainId: subscription.chainId,
        eventName: subscription.config.eventName,
        subscriptionKey
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'successfully unsubscribed from contract event',
          properties: { subscriptionKey, chainId: subscription.chainId }
        })
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'error unsubscribing from contract event',
          error: EcoError.getErrorObject(error),
          properties: { subscriptionKey, chainId: subscription.chainId }
        })
      )

      // Track unsubscription error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BLOCKCHAIN.UNSUBSCRIPTION_ERROR, error, {
        chainId: subscription.chainId,
        subscriptionKey
      })

      throw error
    }
  }

  /**
   * Unsubscribe from all events on a specific chain
   * @param chainId The chain ID to unsubscribe from
   */
  async unsubscribeFromChain(chainId: number): Promise<void> {
    const chainSubscriptions = Array.from(this.subscriptions.entries())
      .filter(([_, subscription]) => subscription.chainId === chainId)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'unsubscribing from all events on chain',
        properties: { chainId, subscriptionCount: chainSubscriptions.length }
      })
    )

    for (const [key, _] of chainSubscriptions) {
      await this.unsubscribeFromContract(key)
    }
  }

  /**
   * Get all active subscriptions
   * @returns Map of subscription keys to subscription managers
   */
  getActiveSubscriptions(): ReadonlyMap<string, SubscriptionManager> {
    return new Map(this.subscriptions)
  }

  /**
   * Get subscription count for a specific chain
   * @param chainId The chain ID to count subscriptions for
   * @returns Number of active subscriptions
   */
  getSubscriptionCount(chainId?: number): number {
    if (chainId === undefined) {
      return this.subscriptions.size
    }

    return Array.from(this.subscriptions.values())
      .filter(subscription => subscription.chainId === chainId).length
  }

  /**
   * Generate a unique subscription key
   * @param chainId Chain ID
   * @param config Event configuration
   * @returns Unique subscription key
   */
  private generateSubscriptionKey(chainId: number, config: EventConfig): string {
    return `${chainId}:${config.address}:${config.eventName}:${Date.now()}`
  }

  /**
   * Determine if error recovery should be attempted
   * @param error The error to check
   * @returns True if recovery should be attempted
   */
  private shouldAttemptRecovery(error: any): boolean {
    // Common RPC errors that can be recovered from
    const recoverableErrorCodes = [
      32000, // Filter not found
      32005, // Limit exceeded
      429,   // Rate limit
      -32603 // Internal error
    ]

    return error?.code && recoverableErrorCodes.includes(error.code)
  }

  /**
   * Attempt to recover from subscription error
   * @param client Public client
   * @param config Event configuration
   * @param chainId Chain ID
   * @param subscriptionKey Subscription key
   */
  private async attemptRecovery(
    client: PublicClient, 
    config: EventConfig,
    chainId: number, 
    subscriptionKey: string
  ): Promise<void> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'attempting subscription recovery',
        properties: { chainId, subscriptionKey }
      })
    )

    try {
      // First unsubscribe existing subscription
      await this.unsubscribeFromContract(subscriptionKey)
      
      // Wait before resubscribing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Resubscribe with same configuration
      await this.subscribeToContract(client, config, chainId)

      // Track successful recovery
      this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.BLOCKCHAIN.SUBSCRIPTION_RECOVERED, {
        chainId,
        eventName: config.eventName,
        subscriptionKey
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'subscription recovery successful',
          properties: { chainId, subscriptionKey }
        })
      )
    } catch (recoveryError) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'subscription recovery failed',
          error: EcoError.getErrorObject(recoveryError),
          properties: { chainId, subscriptionKey }
        })
      )

      // Track recovery failure
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BLOCKCHAIN.SUBSCRIPTION_RECOVERY_FAILED, recoveryError, {
        chainId,
        subscriptionKey
      })
    }
  }
}