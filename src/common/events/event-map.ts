import {
  IntentFulfilledEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

/**
 * Central event map defining all events and their payload types
 * This is the single source of truth for all events in the system
 */
export interface EventMap {
  /**
   * Emitted when a new intent is discovered on any blockchain
   */
  'intent.discovered': {
    intent: Intent;
    strategy?: FulfillmentStrategyName;
  };

  /**
   * Emitted when an intent is successfully fulfilled on the destination chain
   */
  'intent.fulfilled': IntentFulfilledEvent;

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
  const validEvents: EventName[] = [
    'intent.discovered',
    'intent.fulfilled',
    'intent.proven',
    'intent.withdrawn',
  ];
  return validEvents.includes(event as EventName);
}
