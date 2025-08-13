import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { Worker, Job } from 'bullmq'
import { DomainEvent, EventHandler } from '../types/event.types'
import { EventPublisherConfig } from '../publishers/event-publisher'

@Injectable()
export class EventSubscriber implements OnModuleDestroy {
  private readonly logger = new Logger(EventSubscriber.name)
  private readonly eventWorker: Worker
  private readonly eventHandlers = new Map<string, Set<EventHandler>>()

  constructor(config: EventPublisherConfig) {
    // Create a worker to process domain events from Redis
    this.eventWorker = new Worker(
      'domain-events',
      async (job: Job<DomainEvent>) => {
        await this.processEvent(job.data)
      },
      {
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
        },
        concurrency: 10, // Process up to 10 events concurrently
        maxStalledCount: 3
      }
    )

    // Set up error handling
    this.eventWorker.on('error', (error) => {
      this.logger.error(`Event worker error: ${error.message}`)
    })

    this.eventWorker.on('failed', (job, error) => {
      this.logger.error(
        `Failed to process event ${job?.data?.type} (${job?.id}): ${error.message}`
      )
    })

    this.eventWorker.on('completed', (job) => {
      this.logger.debug(`Completed processing event ${job.data.type} (${job.id})`)
    })
  }

  /**
   * Subscribe to domain events from Redis
   */
  subscribe<T extends DomainEvent>(
    eventType: T['type'], 
    handler: EventHandler<T>
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set())
    }
    
    this.eventHandlers.get(eventType)!.add(handler as EventHandler)
    this.logger.debug(`Added Redis subscription for ${eventType}`)
  }

  /**
   * Subscribe to multiple event types with the same handler
   */
  subscribeToMultiple<T extends DomainEvent>(
    eventTypes: T['type'][], 
    handler: EventHandler<T>
  ): void {
    eventTypes.forEach(eventType => {
      this.subscribe(eventType, handler)
    })
  }

  /**
   * Unsubscribe from an event type
   */
  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType)
      }
    }
  }

  /**
   * Get the underlying worker for advanced operations
   */
  getWorker(): Worker {
    return this.eventWorker
  }

  private async processEvent<T extends DomainEvent>(event: T): Promise<void> {
    const handlers = this.eventHandlers.get(event.type)
    
    if (!handlers || handlers.size === 0) {
      this.logger.debug(`No handlers registered for event type: ${event.type}`)
      return
    }

    this.logger.debug(`Processing event ${event.type} with ${handlers.size} handlers`)

    // Execute all handlers for this event type
    const promises = Array.from(handlers).map(async handler => {
      try {
        await handler(event)
      } catch (error) {
        this.logger.error(
          `Handler failed for event ${event.type} (${event.id}): ${error.message}`
        )
        throw error // Rethrow to mark job as failed
      }
    })

    // Wait for all handlers to complete
    // If any handler fails, the job will be marked as failed
    await Promise.all(promises)
  }

  async onModuleDestroy(): Promise<void> {
    await this.eventWorker.close()
  }
}