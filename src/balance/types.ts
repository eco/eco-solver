import { TargetContractType } from '@/eco-configs/eco-config.types'
import { Hex } from 'viem'

export type TokenConfig = {
  address: Hex
  chainId: number
  minBalance: bigint
  targetBalance: bigint
  type: TargetContractType
}

export type TokenBalance = {
  address: Hex
  decimals: {
    original: number
    current: number
  }
  balance: bigint
}
