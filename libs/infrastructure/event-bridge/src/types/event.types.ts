import { Hex } from 'viem'

// Base event interface
export interface BaseEvent<T = any> {
  readonly type: string
  readonly payload: T
  readonly timestamp: Date
  readonly id: string
  readonly source: string
  readonly version: string
}

// Intent domain events
export interface IntentCreatedEvent extends BaseEvent<{
  intentHash: Hex
  creator: Hex
  source: bigint
  destination: bigint
  deadline: bigint
  quoteID?: string
}> {
  type: 'intent.created'
}

export interface IntentFulfilledEvent extends BaseEvent<{
  intentHash: Hex
  fulfiller: Hex
  txHash: Hex
  gasUsed: bigint
  timestamp: Date
}> {
  type: 'intent.fulfilled'
}

export interface IntentExpiredEvent extends BaseEvent<{
  intentHash: Hex
  deadline: bigint
  expiredAt: Date
}> {
  type: 'intent.expired'
}

export interface IntentValidatedEvent extends BaseEvent<{
  intentHash: Hex
  isValid: boolean
  errors?: string[]
}> {
  type: 'intent.validated'
}

// Balance domain events  
export interface BalanceUpdatedEvent extends BaseEvent<{
  address: Hex
  token: Hex
  oldBalance: bigint
  newBalance: bigint
  chainId: bigint
}> {
  type: 'balance.updated'
}

export interface LowBalanceEvent extends BaseEvent<{
  address: Hex
  token: Hex
  currentBalance: bigint
  threshold: bigint
  chainId: bigint
}> {
  type: 'balance.low'
}

// Signer domain events
export interface NonceUpdatedEvent extends BaseEvent<{
  address: Hex
  chainId: bigint
  oldNonce: number
  newNonce: number
}> {
  type: 'signer.nonce.updated'
}

// Queue domain events
export interface JobStartedEvent extends BaseEvent<{
  jobId: string
  jobType: string
  queueName: string
}> {
  type: 'job.started'
}

export interface JobCompletedEvent extends BaseEvent<{
  jobId: string
  jobType: string
  queueName: string
  duration: number
  result?: any
}> {
  type: 'job.completed'
}

export interface JobFailedEvent extends BaseEvent<{
  jobId: string
  jobType: string
  queueName: string
  error: string
  attempt: number
  maxAttempts: number
}> {
  type: 'job.failed'
}

// Union type of all domain events
export type DomainEvent = 
  | IntentCreatedEvent
  | IntentFulfilledEvent
  | IntentExpiredEvent
  | IntentValidatedEvent
  | BalanceUpdatedEvent
  | LowBalanceEvent
  | NonceUpdatedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent

// Event handler types
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void

export interface EventSubscription {
  eventType: string
  handler: EventHandler
  id: string
}