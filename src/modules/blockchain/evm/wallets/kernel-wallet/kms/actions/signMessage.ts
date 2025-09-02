import { CustomSource, hashMessage } from 'viem';

import { sign } from '@/modules/blockchain/evm/wallets/kernel-wallet/kms/actions/sign';
import { IKmsOptions } from '@/modules/blockchain/evm/wallets/kernel-wallet/kms/interfaces/kms-options.interface';

/**
 * @description Signs a hash using a KMS signer.
 *
 * @returns A signature.
 */
export function signMessage(kmsOptions: IKmsOptions): CustomSource['signMessage'] {
  return async (config) => {
    const { message } = config;
    return sign(kmsOptions)!({ hash: hashMessage(message) });
  };
}
