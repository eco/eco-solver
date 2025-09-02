import { CustomSource, keccak256, parseSignature, serializeTransaction } from 'viem';

import { IKmsOptions } from '@/modules/blockchain/evm/wallets/kernel-wallet/kms/interfaces/kms-options.interface';

import { sign } from './sign';

export const signTransaction = (kmsOptions: IKmsOptions): CustomSource['signTransaction'] => {
  return async (transaction, options) => {
    // Viem's `serializeTransaction` omits the `value` field if it is undefined or 0n.
    // This can cause a signature mismatch, as the final transaction sent to the node includes the `value`.
    // We ensure `value` is defined here to guarantee the signed hash matches the final transaction payload.
    transaction.value = transaction.value ?? 0n;

    const serializer = options?.serializer ?? serializeTransaction;

    const signableTransaction =
      transaction.type === 'eip4844' ? { ...transaction, sidecars: false } : transaction;

    const signature = await sign(kmsOptions)!({
      hash: keccak256(serializer(signableTransaction)),
    });

    return serializer(transaction, parseSignature(signature));
  };
};
