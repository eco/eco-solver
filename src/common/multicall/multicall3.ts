import { encodeFunctionData, extractChain, TransactionRequest } from 'viem'
import { Multicall3Abi } from '@/contracts/Multicall3'
import { ChainsSupported } from '@/common/chains/supported'

/**
 * Aggregates transactions using a Multicall contract
 * @param chainID
 * @param transactions
 * @private
 */
export function batchTransactionsWithMulticall(
  chainID: number,
  transactions: TransactionRequest[],
): TransactionRequest {
  if (transactions.length === 1) {
    return transactions[0]
  }

  const totalValue = transactions.reduce((acc, tx) => acc + (tx.value || 0n), 0n)

  const calls = transactions.map((tx) => ({
    target: tx.to!,
    allowFailure: false,
    value: tx.value ?? 0n,
    callData: tx.data ?? '0x',
  }))

  const data = encodeFunctionData({
    abi: Multicall3Abi,
    functionName: 'aggregate3Value',
    args: [calls],
  })

  return { to: getMulticall(chainID), value: totalValue, data }
}

export function getMulticall(chainID: number) {
  const chain = extractChain({
    chains: ChainsSupported,
    id: chainID,
  })
  const multicall3 = chain.contracts?.multicall3?.address
  if (!multicall3) throw new Error(`Multicall not supported for chain ${chainID}`)
  return multicall3
}
