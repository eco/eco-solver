import { ChainAddress, TargetContractType } from '@/eco-configs/eco-config.types'
import { Hex } from 'viem'

export type TokenConfig = {
  address: ChainAddress
  chainId: number
  minBalance: number
  targetBalance: number
  type: TargetContractType
}

export type TokenBalance = {
  address: ChainAddress
  decimals: number
  balance: bigint
}
