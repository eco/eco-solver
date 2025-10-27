import {
  IntentFulfilledEvent,
  IntentFundedEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import type { RhinestoneEvents } from '@/modules/rhinestone/events/rhinestone-event-map';

/**
 * Central event map defining all events and their payload types
 * This is the single source of truth for all events in the system
 */
export interface EventMap extends RhinestoneEvents {
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
