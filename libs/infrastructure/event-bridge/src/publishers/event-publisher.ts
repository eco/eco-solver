import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import { randomUUID } from 'crypto'
import { DomainEvent, EventHandler } from '../types/event.types'

export interface EventPublisherConfig {
  redis: {
    host: string
    port: number
    password?: string
  }
  defaultTTL?: number // Time to live for events in seconds
  retryAttempts?: number
}

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name)
  private readonly eventQueue: Queue
  private readonly subscribers = new Map<string, Set<EventHandler>>()

  constructor(config: EventPublisherConfig) {
    // Create a dedicated event queue for domain events
    this.eventQueue = new Queue('domain-events', {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: config.retryAttempts || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        // TTL is handled at the Redis level, not through BullMQ job options
      },
    })
  }

  /**
   * Publish a domain event to both Redis queue and local subscribers
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    try {
      // Emit to local subscribers first (synchronous)
      await this.emitToLocalSubscribers(event)

      // Then publish to Redis for cross-service communication
      await this.publishToRedis(event)

      this.logger.debug(`Published event: ${event.type} with ID: ${event.id}`)
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.type}: ${error.message}`)
      throw error
    }
  }

  /**
   * Publish multiple events as a batch
   */
  async publishBatch<T extends DomainEvent>(events: T[]): Promise<void> {
    const jobs = events.map((event) => ({
      name: event.type,
      data: event,
      opts: {
        jobId: event.id,
      },
    }))

    await this.eventQueue.addBulk(jobs)

    // Also emit to local subscribers
    for (const event of events) {
      await this.emitToLocalSubscribers(event)
    }

    this.logger.debug(`Published batch of ${events.length} events`)
  }

  /**
   * Subscribe to events locally (within the same process)
   */
  subscribe<T extends DomainEvent>(eventType: T['type'], handler: EventHandler<T>): string {
    const subscriptionId = randomUUID()

    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set())
    }

    this.subscribers.get(eventType)!.add(handler as EventHandler)

    this.logger.debug(`Added local subscription for ${eventType}: ${subscriptionId}`)
    return subscriptionId
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, subscriptionId: string, handler: EventHandler): void {
    const handlers = this.subscribers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.subscribers.delete(eventType)
      }
    }
  }

  /**
   * Get event queue for advanced operations
   */
  getEventQueue(): Queue {
    return this.eventQueue
  }

  private async emitToLocalSubscribers<T extends DomainEvent>(event: T): Promise<void> {
    const handlers = this.subscribers.get(event.type)
    if (!handlers || handlers.size === 0) {
      return
    }

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event)
      } catch (error) {
        this.logger.error(`Error in local event handler for ${event.type}: ${error.message}`)
        // Don't rethrow to prevent one failing handler from affecting others
      }
    })

    await Promise.allSettled(promises)
  }

  private async publishToRedis<T extends DomainEvent>(event: T): Promise<void> {
    await this.eventQueue.add(event.type, event, {
      jobId: event.id,
      priority: this.getEventPriority(event.type),
    })
  }

  private getEventPriority(eventType: string): number {
    // Higher priority for critical events
    const highPriorityEvents = ['intent.fulfilled', 'balance.low', 'job.failed']

    return highPriorityEvents.includes(eventType) ? 10 : 5
  }

  async close(): Promise<void> {
    await this.eventQueue.close()
  }
}
