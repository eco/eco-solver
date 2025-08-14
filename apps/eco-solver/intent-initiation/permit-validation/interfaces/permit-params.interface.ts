import { Address, Hex } from 'viem'

export interface PermitParams {
  tokenAddress: Address
  owner: Address
  spender: Address
  value: bigint
  deadline: bigint
  nonce?: bigint
  signature: Hex
}
