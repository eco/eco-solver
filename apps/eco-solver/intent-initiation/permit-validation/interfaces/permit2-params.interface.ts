import { Address, Hex } from 'viem'

export interface Permit2Details {
  token: Address
  amount: bigint
  expiration: bigint
  nonce: bigint
}

export interface Permit2Params {
  permit2Address: Address
  owner: Address
  spender: Address
  sigDeadline: bigint
  details: Permit2Details[]
  signature: Hex
}
