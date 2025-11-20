import { Hex } from 'viem'

export interface SignatureValidationData {
  signature: Hex
  address: Hex
  expire: string
}
