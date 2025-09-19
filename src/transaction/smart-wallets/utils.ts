import { ExecuteSmartWalletArgs } from './smart-wallet.types'

/**
 * Throws if we don`t support value send in batch transactions, {@link SimpleAccountClient}
 * @param transactions the transactions to execute
 */
export function throwIfValueSendInBatch(transactions: ExecuteSmartWalletArgs) {
  if (
    transactions.length > 1 &&
    transactions.some((tx) => tx.value !== undefined || tx.value !== 0n)
  ) {
    throw new Error('Value send is not support value in batch transactions')
  }
}

/**
 * Checks if the transaction is a legacy transaction.
 * @param chainID the chain ID to check
 * @returns an object indicating the transaction type
 * TODO: mainnet plasma release should not need this according to @kayoonee on telegram
 */
export function legacyTx(chainID: number | undefined): any {
  const isLegacy = chainID == 9745 // EIP-1559 not supported on plasma mainnet yet
  return isLegacy ? { type: 'legacy' } : {}
}
