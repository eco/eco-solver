import { Signer } from '@eco-foundation/eco-kms-core';

export interface IKmsOptions {
  to?: string;
  keyID: string;
  signer: Signer;
  addressBuffer: Buffer;
}
