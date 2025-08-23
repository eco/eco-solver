import { signKms, KmsSignParameters } from './signKms'
import {
  keccak256,
  serializeTransaction,
  SerializeTransactionFn,
  TransactionSerializable,
} from 'viem'
import { SignTransactionParameters, SignTransactionReturnType } from 'viem/accounts'

export async function signKmsTransaction<
  serializer extends SerializeTransactionFn<TransactionSerializable> = SerializeTransactionFn<TransactionSerializable>,
  transaction extends Parameters<serializer>[0] = Parameters<serializer>[0],
>(
  parameters: Omit<SignTransactionParameters<serializer, transaction>, 'privateKey'> & {
    config: Omit<KmsSignParameters, 'hash'>
  },
): Promise<SignTransactionReturnType<serializer, transaction>> {
  const { transaction, serializer = serializeTransaction, config } = parameters

  // viem's `serializeTransaction` omits the `value` field if it is undefined or 0n.
  // This can cause a signature mismatch, as the final transaction sent to the node includes the `value`.
  // We ensure `value` is defined here to guarantee the signed hash matches the final transaction payload.
  transaction.value = transaction.value ?? 0n

  const signableTransaction = (() => {
    // For EIP-4844 Transactions, we want to sign the transaction payload body (tx_payload_body) without the sidecars (ie. without the network wrapper).
    // See: https://github.com/ethereum/EIPs/blob/e00f4daa66bd56e2dbd5f1d36d09fd613811a48b/EIPS/eip-4844.md#networking
    if (transaction.type === 'eip4844')
      return {
        ...transaction,
        sidecars: false,
      }
    return transaction
  })()
  const signature = await signKms({
    ...config,
    hash: keccak256(serializer(signableTransaction)),
    to: 'object',
  })
  return serializer(transaction, signature) as SignTransactionReturnType<serializer, transaction>
}
