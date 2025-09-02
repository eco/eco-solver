import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventMap } from '@/common/events/event-map';

/**
 * Injectable service that provides type-safe event emitting capabilities
 * This service wraps the EventEmitter2 and provides it as a NestJS service
 */
@Injectable()
export class EventsService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Type-safe emit method
   * @param event - Event name from EventMap
   * @param payload - Strongly typed payload for the event
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): boolean {
    return this.eventEmitter.emit(event, payload);
  }

  /**
   * Type-safe emitAsync method
   * @param event - Event name from EventMap
   * @param payload - Strongly typed payload for the event
   */
  emitAsync<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<any[]> {
    return this.eventEmitter.emitAsync(event, payload);
  }

  /**
   * Type-safe on method for adding event listeners
   * @param event - Event name from EventMap
   * @param listener - Callback with strongly typed payload
   */
  on<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void | Promise<void>,
  ): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  /**
   * Type-safe once method for one-time event listeners
   * @param event - Event name from EventMap
   * @param listener - Callback with strongly typed payload
   */
  once<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void | Promise<void>,
  ): this {
    this.eventEmitter.once(event, listener);
    return this;
  }

  /**
   * Type-safe off method for removing event listeners
   * @param event - Event name from EventMap
   * @param listener - Callback to remove
   */
  off<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void | Promise<void>,
  ): this {
    this.eventEmitter.off(event, listener);
    return this;
  }

  /**
   * Type-safe removeListener method (alias for off)
   * @param event - Event name from EventMap
   * @param listener - Callback to remove
   */
  removeListener<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void | Promise<void>,
  ): this {
    this.eventEmitter.removeListener(event, listener);
    return this;
  }

  /**
   * Type-safe removeAllListeners method
   * @param event - Optional event name from EventMap
   */
  removeAllListeners<K extends keyof EventMap>(event?: K): this {
    this.eventEmitter.removeAllListeners(event);
    return this;
  }

  /**
   * Type-safe addListener method (alias for on)
   * @param event - Event name from EventMap
   * @param listener - Callback with strongly typed payload
   */
  addListener<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void | Promise<void>,
  ): this {
    this.eventEmitter.addListener(event, listener);
    return this;
  }

  /**
   * Get the underlying EventEmitter2 instance
   * Useful for integration with @OnEvent decorators
   */
  getEmitter(): EventEmitter2 {
    return this.eventEmitter;
  }

  /**
   * Get event names with type safety
   */
  eventNames(): Array<keyof EventMap> {
    return this.eventEmitter.eventNames() as Array<keyof EventMap>;
  }

  /**
   * Get listeners for a specific event
   * @param event - Event name from EventMap
   */
  listeners<K extends keyof EventMap>(event: K): Array<(payload: EventMap[K]) => void> {
    return this.eventEmitter.listeners(event);
  }

  /**
   * Get listener count for a specific event
   * @param event - Event name from EventMap
   */
  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.eventEmitter.listenerCount(event);
  }
}
