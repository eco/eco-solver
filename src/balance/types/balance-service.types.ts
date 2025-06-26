import { Hex } from 'viem'

export type CreateBalanceChangeParams = {
  chainId: number
  address: Hex | 'native'
  changeAmount: string
  direction: 'incoming' | 'outgoing'
  blockNumber: string
  blockHash: string
  transactionHash: string
  from?: string
  to?: string
}

export type UpdateBalanceFromRpcParams = {
  chainId: number
  address: Hex | 'native'
  balance: string
  blockNumber: string
  blockHash: string
  decimals?: number
  tokenSymbol?: string
  tokenName?: string
}
