import {
  IntentFulfilledEvent,
  IntentFundedEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';

/**
 * Central event map defining all events and their payload types
 * This is the single source of truth for all events in the system
 */
export interface EventMap {
  /**
   * Emitted when an intent is successfully fulfilled on the destination chain
   */
  'intent.fulfilled': IntentFulfilledEvent;

  /**
   * Emitted when an intent is funded on the source chain
   */
  'intent.funded': IntentFundedEvent;

  /**
   * Emitted when an intent is proven on the source chain
   */
  'intent.proven': IntentProvenEvent;

  /**
   * Emitted when an intent is withdrawn on the source chain
   */
  'intent.withdrawn': IntentWithdrawnEvent;

  /**
   * Rhinestone WebSocket Events
   * Connection lifecycle and authentication events
   */

  /**
   * Emitted when WebSocket connection is established
   */
  'rhinestone.connected': void;

  /**
   * Emitted when successfully authenticated with Rhinestone orchestrator
   */
  'rhinestone.authenticated': {
    connectionId: string;
  };

  /**
   * Emitted when WebSocket connection is closed
   */
  'rhinestone.disconnected': {
    code: number;
    reason: string;
  };

  /**
   * Emitted when WebSocket error occurs
   */
  'rhinestone.error': {
    error: Error;
    errorCode?: number;
    messageId?: string;
  };

  /**
   * Emitted when authentication fails
   */
  'rhinestone.auth.failed': {
    errorCode: number;
    message: string;
  };

  /**
   * Emitted when max reconnection attempts are reached
   */
  'rhinestone.reconnect.failed': void;
}

/**
 * Type helper to extract event names
 */
export type EventName = keyof EventMap;

/**
 * Type helper to extract payload type for a specific event
 */
export type EventPayload<T extends EventName> = EventMap[T];

/**
 * Type guard to check if a string is a valid event name
 */
export function isValidEventName(event: string): event is EventName {
  const validEvents: EventName[] = ['intent.fulfilled', 'intent.proven', 'intent.withdrawn'];
  return validEvents.includes(event as EventName);
}
