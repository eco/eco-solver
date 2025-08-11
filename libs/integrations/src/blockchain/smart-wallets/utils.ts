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
