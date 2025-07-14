import { Hex } from 'viem'
import { IntentType } from '@eco-foundation/routes-ts'

export interface FulfillActionArgs {
  intent: IntentType
  publicKey?: string
}

export interface FulfillActionResponse {
  signature: Hex
  rewardVault: Hex
  routeHash: Hex
  rewardHash: Hex
  expectedHash: Hex
  localProver: Hex
  ttl: number
  accessLiquidityHash: Hex
  targetAmount: string
  executionFee: string
}
