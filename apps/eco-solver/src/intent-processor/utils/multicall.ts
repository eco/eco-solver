import { extractChain } from 'viem'
import { ChainsSupported } from '@eco-solver/common/chains/supported'

export function getMulticall(chainID: number) {
  const chain = extractChain({
    chains: ChainsSupported,
    id: chainID,
  })
  const multicall3 = chain.contracts?.multicall3?.address
  if (!multicall3) throw new Error(`Multicall not supported for chain ${chainID}`)
  return multicall3
}
