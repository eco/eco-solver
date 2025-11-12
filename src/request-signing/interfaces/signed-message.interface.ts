import { Hex } from 'viem';

export interface SignedMessage {
  signature: Hex;
  expiryTime: number;
}
