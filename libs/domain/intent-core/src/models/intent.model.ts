import { Hex } from 'viem'
import { IntentType } from '@eco/foundation-eco-adapter'
import { CreateIntentParams, IntentStatus, IntentMetadata, RewardTokensInterface, CallDataInterface } from '../types/intent.types'

// Core Intent domain model
export class IntentModel implements IntentType {
  public readonly hash: Hex
  public readonly salt: Hex
  public readonly source: bigint
  public readonly destination: bigint
  public readonly inbox: Hex
  public readonly creator: Hex
  public readonly prover: Hex
  public readonly deadline: bigint
  public readonly nativeValue: bigint
  public readonly calls: CallDataInterface[]
  public readonly rewardTokens: RewardTokensInterface[]
  
  // Domain-specific properties
  public readonly quoteID?: string
  public readonly routeTokens: RewardTokensInterface[]
  public readonly logIndex: number
  public readonly funder?: Hex
  
  // Status and metadata
  private _status: IntentStatus
  private _metadata: IntentMetadata

  constructor(params: CreateIntentParams) {
    this.hash = params.hash
    this.salt = params.salt
    this.source = params.source
    this.destination = params.destination
    this.inbox = params.inbox
    this.creator = params.creator
    this.prover = params.prover
    this.deadline = params.deadline
    this.nativeValue = params.nativeValue
    this.calls = params.calls
    this.rewardTokens = params.rewardTokens
    
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
    return now > this.deadline
  }

  canBeFulfilled(): boolean {
    return this._status.isActive && 
           !this._status.isFulfilled && 
           !this._status.isExpired && 
           !this.isExpired()
  }

  getTotalRewardValue(): bigint {
    return this.rewardTokens.reduce((total, token) => total + token.amount, 0n) + this.nativeValue
  }
}