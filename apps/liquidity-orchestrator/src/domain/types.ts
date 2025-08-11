import { Hex } from 'viem'
import { TargetContractType } from '@libs/contracts'

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
