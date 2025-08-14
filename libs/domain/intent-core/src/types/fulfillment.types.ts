import { Hex } from 'viem'

// Fulfillment domain types
export interface FulfillmentProvider {
  name: string
  address: Hex
  supported: boolean
  estimatedGas?: bigint
  estimatedTime?: number // seconds
}

export interface FulfillmentRequest {
  intentHash: Hex
  solver: FulfillmentProvider
  deadline: bigint
  maxGasPrice?: bigint
}

export interface FulfillmentResult {
  success: boolean
  txHash?: Hex
  error?: string
  gasUsed?: bigint
  timestamp: Date
}

export interface FulfillmentEstimate {
  provider: FulfillmentProvider
  estimatedCost: bigint
  estimatedTime: number
  probability: number // 0-1 success probability
}
