import { TargetContractType } from '@eco-solver/eco-configs/eco-config.types'
import { Hex } from "viem"

export type TokenConfig = {
  address: Hex
  chainId: number
  minBalance: number
  targetBalance: number
  type: TargetContractType
}

export type TokenBalance = {
  address: Hex
  decimals: number
  balance: bigint
}
