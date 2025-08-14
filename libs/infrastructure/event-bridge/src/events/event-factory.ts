import { randomUUID } from 'crypto'
import {
  BaseEvent,
  DomainEvent,
  IntentCreatedEvent,
  IntentFulfilledEvent,
  IntentExpiredEvent,
  IntentValidatedEvent,
  BalanceUpdatedEvent,
  LowBalanceEvent,
  NonceUpdatedEvent,
  JobStartedEvent,
  JobCompletedEvent,
  JobFailedEvent,
} from '../types/event.types'

// Event factory for creating type-safe domain events
export class EventFactory {
  private static readonly EVENT_VERSION = '1.0.0'
  private static readonly EVENT_SOURCE = 'eco-solver'

  private static createBaseEvent<T>(type: string, payload: T): BaseEvent<T> {
    return {
      type,
      payload,
      timestamp: new Date(),
      id: randomUUID(),
      source: this.EVENT_SOURCE,
      version: this.EVENT_VERSION,
    }
  }

  // Intent events
  static createIntentCreatedEvent(payload: IntentCreatedEvent['payload']): IntentCreatedEvent {
    return {
      ...this.createBaseEvent('intent.created', payload),
      type: 'intent.created',
    }
  }

  static createIntentFulfilledEvent(
    payload: IntentFulfilledEvent['payload'],
  ): IntentFulfilledEvent {
    return {
      ...this.createBaseEvent('intent.fulfilled', payload),
      type: 'intent.fulfilled',
    }
  }

  static createIntentExpiredEvent(payload: IntentExpiredEvent['payload']): IntentExpiredEvent {
    return {
      ...this.createBaseEvent('intent.expired', payload),
      type: 'intent.expired',
    }
  }

  static createIntentValidatedEvent(
    payload: IntentValidatedEvent['payload'],
  ): IntentValidatedEvent {
    return {
      ...this.createBaseEvent('intent.validated', payload),
      type: 'intent.validated',
    }
  }

  // Balance events
  static createBalanceUpdatedEvent(payload: BalanceUpdatedEvent['payload']): BalanceUpdatedEvent {
    return {
      ...this.createBaseEvent('balance.updated', payload),
      type: 'balance.updated',
    }
  }

  static createLowBalanceEvent(payload: LowBalanceEvent['payload']): LowBalanceEvent {
    return {
      ...this.createBaseEvent('balance.low', payload),
      type: 'balance.low',
    }
  }

  // Signer events
  static createNonceUpdatedEvent(payload: NonceUpdatedEvent['payload']): NonceUpdatedEvent {
    return {
      ...this.createBaseEvent('signer.nonce.updated', payload),
      type: 'signer.nonce.updated',
    }
  }

  // Job events
  static createJobStartedEvent(payload: JobStartedEvent['payload']): JobStartedEvent {
    return {
      ...this.createBaseEvent('job.started', payload),
      type: 'job.started',
    }
  }

  static createJobCompletedEvent(payload: JobCompletedEvent['payload']): JobCompletedEvent {
    return {
      ...this.createBaseEvent('job.completed', payload),
      type: 'job.completed',
    }
  }

  static createJobFailedEvent(payload: JobFailedEvent['payload']): JobFailedEvent {
    return {
      ...this.createBaseEvent('job.failed', payload),
      type: 'job.failed',
    }
  }
}
