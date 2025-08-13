import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { EventPublisher, EventPublisherConfig } from './publishers/event-publisher'
import { EventSubscriber } from './subscribers/event-subscriber'
import { EventFactory } from './events/event-factory'
import { DomainEvent, EventHandler } from './types/event.types'

@Injectable()
export class EventBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBridgeService.name)
  private readonly eventPublisher: EventPublisher
  private readonly eventSubscriber: EventSubscriber

  constructor(config: EventPublisherConfig) {
    this.eventPublisher = new EventPublisher(config)
    this.eventSubscriber = new EventSubscriber(config)
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Event Bridge Service initialized')
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.eventPublisher.close(),
      this.eventSubscriber.onModuleDestroy()
    ])
    this.logger.log('Event Bridge Service destroyed')
  }

  // Event Publishing Methods
  async publishEvent<T extends DomainEvent>(event: T): Promise<void> {
    return this.eventPublisher.publish(event)
  }

  async publishEvents<T extends DomainEvent>(events: T[]): Promise<void> {
    return this.eventPublisher.publishBatch(events)
  }

  // Local Subscription Methods (within same process)
  subscribeLocal<T extends DomainEvent>(
    eventType: T['type'], 
    handler: EventHandler<T>
  ): string {
    return this.eventPublisher.subscribe(eventType, handler)
  }

  unsubscribeLocal(eventType: string, subscriptionId: string, handler: EventHandler): void {
    this.eventPublisher.unsubscribe(eventType, subscriptionId, handler)
  }

  // Redis Subscription Methods (cross-process/service)
  subscribeRedis<T extends DomainEvent>(
    eventType: T['type'], 
    handler: EventHandler<T>
  ): void {
    this.eventSubscriber.subscribe(eventType, handler)
  }

  subscribeRedisMultiple<T extends DomainEvent>(
    eventTypes: T['type'][], 
    handler: EventHandler<T>
  ): void {
    this.eventSubscriber.subscribeToMultiple(eventTypes, handler)
  }

  unsubscribeRedis(eventType: string, handler: EventHandler): void {
    this.eventSubscriber.unsubscribe(eventType, handler)
  }

  // Convenience methods for creating events
  get events() {
    return EventFactory
  }

  // Advanced access to underlying infrastructure
  getEventPublisher(): EventPublisher {
    return this.eventPublisher
  }

  getEventSubscriber(): EventSubscriber {
    return this.eventSubscriber
  }
}