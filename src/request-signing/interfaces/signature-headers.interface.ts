export const SIGNATURE_HEADER = 'x-beam-sig' as const;
export const SIGNATURE_ADDRESS_HEADER = 'x-beam-sig-address' as const;
export const SIGNATURE_EXPIRE_HEADER = 'x-beam-sig-expire' as const;

export interface SignatureHeaders {
  [SIGNATURE_HEADER]: string;
  [SIGNATURE_ADDRESS_HEADER]: string;
  [SIGNATURE_EXPIRE_HEADER]: number; // Parsed timestamp value, not raw header string
}
