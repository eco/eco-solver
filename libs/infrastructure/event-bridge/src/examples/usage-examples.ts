/**
 * Examples showing how to use the Event Bridge system
 */

import { Injectable, Logger } from '@nestjs/common'
import { EventBridgeService } from '../event-bridge.service'
import { IntentCreatedEvent, BalanceUpdatedEvent, LowBalanceEvent } from '../types/event.types'

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name)

  constructor(private readonly eventBridge: EventBridgeService) {}

  async createIntent(intentData: any): Promise<void> {
    // ... intent creation logic ...

    // Publish domain event
    const event = this.eventBridge.events.createIntentCreatedEvent({
      intentHash: '0x1234567890abcdef1234567890abcdef12345678',
      creator: '0x3333333333333333333333333333333333333333',
      source: 1n,
      destination: 137n,
      deadline: BigInt(Date.now() / 1000) + 3600n,
      quoteID: 'quote-123',
    })

    await this.eventBridge.publishEvent(event)
    this.logger.log(`Published intent created event: ${event.id}`)
  }
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  constructor(private readonly eventBridge: EventBridgeService) {
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // Subscribe to intent events locally (same process)
    this.eventBridge.subscribeLocal('intent.created', async (event: IntentCreatedEvent) => {
      this.logger.log(`New intent created: ${event.payload.intentHash}`)
      // Send notification logic here
    })

    // Subscribe to balance events from Redis (cross-service)
    this.eventBridge.subscribeRedis('balance.low', async (event: LowBalanceEvent) => {
      this.logger.warn(`Low balance alert: ${event.payload.address}`)
      // Send alert notification
    })

    // Subscribe to multiple event types
    this.eventBridge.subscribeRedisMultiple(
      ['intent.fulfilled', 'intent.expired'],
      async (event) => {
        this.logger.log(`Intent lifecycle event: ${event.type}`)
        // Handle intent lifecycle changes
      },
    )
  }
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(private readonly eventBridge: EventBridgeService) {
    this.setupAnalytics()
  }

  private setupAnalytics(): void {
    // Subscribe to all intent events for analytics
    const intentEventTypes = [
      'intent.created',
      'intent.fulfilled',
      'intent.expired',
      'intent.validated',
    ] as const

    intentEventTypes.forEach((eventType) => {
      this.eventBridge.subscribeRedis(eventType, async (event) => {
        await this.recordAnalyticsEvent({
          eventType: event.type,
          eventId: event.id,
          timestamp: event.timestamp,
          payload: event.payload,
        })
      })
    })
  }

  private async recordAnalyticsEvent(data: any): Promise<void> {
    // Record to analytics database
    this.logger.debug(`Recording analytics event: ${data.eventType}`)
  }
}

// Example of batch event publishing
@Injectable()
export class BatchProcessor {
  constructor(private readonly eventBridge: EventBridgeService) {}

  async processBatchIntents(intents: any[]): Promise<void> {
    const events = intents.map((intent) =>
      this.eventBridge.events.createIntentCreatedEvent({
        intentHash: intent.hash,
        creator: intent.creator,
        source: intent.source,
        destination: intent.destination,
        deadline: intent.deadline,
      }),
    )

    // Publish all events as a batch for better performance
    await this.eventBridge.publishEvents(events)
  }
}

// Example integration with existing BullMQ processors
@Injectable()
export class EnhancedProcessor {
  constructor(private readonly eventBridge: EventBridgeService) {}

  async processJob(jobData: any): Promise<void> {
    // Emit job started event
    await this.eventBridge.publishEvent(
      this.eventBridge.events.createJobStartedEvent({
        jobId: jobData.id,
        jobType: 'intent-processing',
        queueName: 'solver',
      }),
    )

    try {
      // ... existing job processing logic ...

      // Emit job completed event
      await this.eventBridge.publishEvent(
        this.eventBridge.events.createJobCompletedEvent({
          jobId: jobData.id,
          jobType: 'intent-processing',
          queueName: 'solver',
          duration: 1500,
          result: { success: true },
        }),
      )
    } catch (error) {
      // Emit job failed event
      await this.eventBridge.publishEvent(
        this.eventBridge.events.createJobFailedEvent({
          jobId: jobData.id,
          jobType: 'intent-processing',
          queueName: 'solver',
          error: error instanceof Error ? error : new Error(String(error)),
          attempt: 1,
          maxAttempts: 3,
        }),
      )
      throw error
    }
  }
}
