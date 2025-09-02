import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventMap } from './event-map';

/**
 * Type-safe event emitter that extends EventEmitter2
 * Provides compile-time type checking for event names and payloads
 */
export class EventEmitter extends EventEmitter2 {
  /**
   * Type-safe emit method
   * @param event - Event name from EventMap
   * @param payload - Strongly typed payload for the event
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): boolean {
    return super.emit(event as string, payload);
  }

  /**
   * Type-safe emitAsync method
   * @param event - Event name from EventMap
   * @param payload - Strongly typed payload for the event
   */
  emitAsync<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<any[]> {
    return super.emitAsync(event as string, payload);
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
    super.on(event as string, listener);
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
    super.once(event as string, listener);
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
    super.off(event as string, listener);
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
    super.removeListener(event as string, listener);
    return this;
  }

  /**
   * Type-safe removeAllListeners method
   * @param event - Optional event name from EventMap
   */
  removeAllListeners<K extends keyof EventMap>(event?: K): this {
    super.removeAllListeners(event as string);
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
    super.addListener(event as string, listener);
    return this;
  }

  /**
   * Type-safe prependListener method
   * @param event - Event name from EventMap
   * @param listener - Callback with strongly typed payload
   */
  prependListener<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void | Promise<void>,
  ): this {
    super.prependListener(event as string, listener);
    return this;
  }

  /**
   * Type-safe prependOnceListener method
   * @param event - Event name from EventMap
   * @param listener - Callback with strongly typed payload
   */
  prependOnceListener<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void | Promise<void>,
  ): this {
    super.prependOnceListener(event as string, listener);
    return this;
  }

  /**
   * Get event names with type safety
   */
  eventNames(): Array<keyof EventMap> {
    return super.eventNames() as Array<keyof EventMap>;
  }

  /**
   * Get listeners for a specific event
   * @param event - Event name from EventMap
   */
  listeners<K extends keyof EventMap>(event: K): Array<(payload: EventMap[K]) => void> {
    return super.listeners(event as string) as Array<(payload: EventMap[K]) => void>;
  }

  /**
   * Get listener count for a specific event
   * @param event - Event name from EventMap
   */
  listenerCount<K extends keyof EventMap>(event: K): number {
    return super.listenerCount(event as string);
  }
}
