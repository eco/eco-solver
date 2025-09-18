import { Hex } from 'viem'

export interface PermitDetails {
  token: Hex
  amount: bigint
  expiration: number
  nonce: number
}
