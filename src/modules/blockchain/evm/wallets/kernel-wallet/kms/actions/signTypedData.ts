import {
  CustomSource,
  hashTypedData,
  SignTypedDataParameters,
  SignTypedDataReturnType,
} from 'viem';

import { IKmsOptions } from '@/modules/blockchain/evm/wallets/kernel-wallet/kms/interfaces/kms-options.interface';

import { sign } from './sign';

export const signTypedData = (kmsOptions: IKmsOptions): CustomSource['signTypedData'] => {
  return (parameters): Promise<SignTypedDataReturnType> => {
    return sign(kmsOptions)!({
      hash: hashTypedData(parameters as unknown as SignTypedDataParameters),
    });
  };
};
