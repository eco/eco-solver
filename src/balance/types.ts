import { Address, TargetContractType } from '@/eco-configs/eco-config.types'
import { Hex } from 'viem'

export type TokenConfig = {
  address: Address
  chainId: number
  minBalance: number
  targetBalance: number
  type: TargetContractType
}

export type TokenBalance = {
  address: Address
  decimals: number
  balance: bigint
}
