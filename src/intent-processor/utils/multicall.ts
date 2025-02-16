import { extractChain } from 'viem'
import { ChainsSupported } from '@/common/chains/supported'

export function getMulticall(chainID: number) {
  const chain = extractChain({
    chains: ChainsSupported,
    id: chainID,
  })
  return chain.contracts?.multicall3?.address ?? '0xcA11bde05977b3631167028862bE2a173976CA11'
}
