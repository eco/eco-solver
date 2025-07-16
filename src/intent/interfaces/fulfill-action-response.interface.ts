import { Hex } from 'viem'
import { IntentType } from '@eco-foundation/routes-ts'
import { BigIntsToStrings } from '@/common/types/generics'

export interface FulfillActionArgs {
  publicKey?: string
  intent: BigIntsToStrings<IntentType>
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
