export const SIGNATURE_HEADER = 'x-beam-sig'
export const SIGNATURE_ADDRESS_HEADER = 'x-beam-sig-address'
export const SIGNATURE_EXPIRE_HEADER = 'x-beam-sig-expire'

export interface SignatureHeaders {
  [SIGNATURE_HEADER]: string
  [SIGNATURE_ADDRESS_HEADER]: string
  [SIGNATURE_EXPIRE_HEADER]: number
}
