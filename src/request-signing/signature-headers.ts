import { Hex } from 'viem'

export const SIGNATURE_HEADER = 'x-beam-sig'
export const SIGNATURE_ADDRESS_HEADER = 'x-beam-sig-address'
export const SIGNATURE_EXPIRE_HEADER = 'x-beam-sig-expire'

export interface SignatureHeaders {
  [SIGNATURE_HEADER]: string
  [SIGNATURE_ADDRESS_HEADER]: string
  [SIGNATURE_EXPIRE_HEADER]: number
}

export function getSignatureHeaders(
  signature: Hex,
  address: Hex,
  expiryTime: number,
): SignatureHeaders {
  return {
    [SIGNATURE_HEADER]: signature,
    [SIGNATURE_ADDRESS_HEADER]: address,
    [SIGNATURE_EXPIRE_HEADER]: expiryTime,
  }
}
