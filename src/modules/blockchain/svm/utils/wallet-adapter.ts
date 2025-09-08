import { Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';

export function getAnchorWallet(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if ('version' in tx) {
        // Versioned transaction
        (tx as VersionedTransaction).sign([keypair]);
      } else {
        // Legacy transaction
        (tx as Transaction).partialSign(keypair);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[],
    ): Promise<T[]> => {
      return txs.map((tx) => {
        if ('version' in tx) {
          (tx as VersionedTransaction).sign([keypair]);
        } else {
          (tx as Transaction).partialSign(keypair);
        }
        return tx;
      });
    },
  };
}
