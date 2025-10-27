import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

import { ISvmWallet } from '@/common/interfaces/svm-wallet.interface';

export function getAnchorWallet(wallet: ISvmWallet, publicKey: PublicKey) {
  return {
    publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      return (await wallet.signTransaction(tx)) as T;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[],
    ): Promise<T[]> => {
      return Promise.all(txs.map((tx) => wallet.signTransaction(tx))) as Promise<T[]>;
    },
  };
}
