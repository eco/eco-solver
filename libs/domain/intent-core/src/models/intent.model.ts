import { Hex } from 'viem'
import { IntentType } from '@eco/foundation-eco-adapter'
import { CreateIntentParams, IntentStatus, IntentMetadata, RewardTokensInterface, CallDataInterface } from '../types/intent.types'

// Core Intent domain model
export class IntentModel implements IntentType {
  public readonly route: {
    salt: Hex
    source: bigint
    destination: bigint
    inbox: Hex
    tokens: readonly { token: Hex; amount: bigint }[]
    calls: readonly { target: Hex; data: Hex; value: bigint }[]
  }
  
  public readonly reward: {
    creator: Hex
    prover: Hex
    deadline: bigint
    nativeValue: bigint
    tokens: readonly { token: Hex; amount: bigint }[]
  }
  
  // Domain-specific properties
  public readonly hash: Hex
  public readonly quoteID?: string
  public readonly routeTokens: RewardTokensInterface[]
  public readonly logIndex: number
  public readonly funder?: Hex
  
  // Status and metadata
  private _status: IntentStatus
  private _metadata: IntentMetadata

  constructor(params: CreateIntentParams) {
    this.route = {
      salt: params.salt,
      source: params.source,
      destination: params.destination,
      inbox: params.inbox,
      tokens: params.rewardTokens.map(t => ({ token: t.token, amount: t.amount })),
      calls: params.calls.map(c => ({ target: c.to, data: c.data, value: c.value }))
    }
    
    this.reward = {
      creator: params.creator,
      prover: params.prover,
      deadline: params.deadline,
      nativeValue: params.nativeValue,
      tokens: params.rewardTokens.map(t => ({ token: t.token, amount: t.amount }))
    }
    
    this.hash = params.hash
    this.quoteID = params.quoteID
    this.routeTokens = params.routeTokens
    this.logIndex = params.logIndex
    this.funder = params.funder
    
    this._status = {
      isActive: true,
      isFulfilled: false,
      isExpired: false
    }
    
    this._metadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    }
  }

  // Domain methods
  get status(): IntentStatus {
    return { ...this._status }
  }

  get metadata(): IntentMetadata {
    return { ...this._metadata }
  }

  // Backward compatibility getters
  get calls() {
    return this.route.calls
  }

  get rewardTokens() {
    return this.routeTokens
  }

  markAsFulfilled(txHash: Hex): void {
    this._status.isFulfilled = true
    this._status.fulfillmentTxHash = txHash
    this._status.fulfillmentTimestamp = new Date()
    this._metadata.updatedAt = new Date()
    this._metadata.version++
  }

  markAsExpired(): void {
    this._status.isExpired = true
    this._status.isActive = false
    this._metadata.updatedAt = new Date()
    this._metadata.version++
  }

  isExpired(): boolean {
    const now = BigInt(Math.floor(Date.now() / 1000))
    return now > this.reward.deadline
  }

  canBeFulfilled(): boolean {
    return this._status.isActive && 
           !this._status.isFulfilled && 
           !this._status.isExpired && 
           !this.isExpired()
  }

  getTotalRewardValue(): bigint {
    return this.reward.tokens.reduce((total, token) => total + token.amount, 0n) + this.reward.nativeValue
  }
}