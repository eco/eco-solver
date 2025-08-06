import { CustomSource } from 'viem';

import { IKmsOptions } from '@/modules/blockchain/evm/wallets/kernel-wallet/kms/interfaces/kms-options.interface';

/**
 * @description Signs a hash using a KMS signer.
 *
 * @returns A signature.
 */
export function sign(kmsOptions: IKmsOptions): CustomSource['sign'] {
  return (config) => {
    const { signer, keyID, addressBuffer } = kmsOptions;
    return signer.signDigest({ keyId: keyID, address: addressBuffer }, config.hash);
  };
}
