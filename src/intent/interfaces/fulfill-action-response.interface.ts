import { Hex } from 'viem'

export interface FulfillActionArgs {
  publicKey?: string
  intent: {
    route: {
      salt: Hex
      inbox: Hex
      source: number
      destination: number
      calls: readonly {
        data: Hex
        target: Hex
        value: string
      }[]
      tokens: readonly {
        token: Hex
        amount: string
      }[]
    }
    reward: {
      prover: Hex
      creator: Hex
      deadline: number
      nativeValue: string
      tokens: readonly {
        token: Hex
        amount: string
      }[]
    }
  }
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
