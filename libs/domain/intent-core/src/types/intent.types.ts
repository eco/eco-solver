import { Hex } from 'viem'

// Core intent domain types
export interface RewardTokensInterface {
  token: Hex
  amount: bigint
}

export interface CallDataInterface {
  to: Hex
  value: bigint
  data: Hex
}

export interface CreateIntentParams {
  quoteID?: string
  hash: Hex
  salt: Hex
  source: bigint
  destination: bigint
  inbox: Hex
  routeTokens: RewardTokensInterface[]
  calls: CallDataInterface[]
  creator: Hex
  prover: Hex
  deadline: bigint
  nativeValue: bigint
  rewardTokens: RewardTokensInterface[]
  logIndex: number
  funder?: Hex
}

export interface IntentStatus {
  isActive: boolean
  isFulfilled: boolean
  isExpired: boolean
  fulfillmentTxHash?: Hex
  fulfillmentTimestamp?: Date
}

export interface IntentMetadata {
  createdAt: Date
  updatedAt: Date
  version: number
  tags?: string[]
}