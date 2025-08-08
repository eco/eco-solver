import { EcoChains } from '@eco-foundation/chains'
import { getAddress } from 'viem'

const ecoChains = new EcoChains({})
let stablesCache: Map<string, Map<string, number>> | null = null

/**
 * Finds the decimal count for a token address on a specific chain
 * @param tokenAddress The token address to look up
 * @param chainId The chain ID to search on
 * @returns The number of decimals for the token, or null if not found
 */
export function findTokenDecimals(tokenAddress: string, chainId: number): number | null {
  const cacheKey = `${chainId}`

  // Initialize cache if needed
  if (!stablesCache) {
    stablesCache = new Map()
  }

  // Check if we have cached data for this chain
  if (!stablesCache.has(cacheKey)) {
    try {
      const stables = ecoChains.getStablesForChain(chainId)
      const chainCache = new Map<string, number>()

      Object.values(stables).forEach((stable) => {
        chainCache.set(getAddress(stable.address), stable.decimals)
      })

      stablesCache.set(cacheKey, chainCache)
    } catch (error) {
      return null
    }
  }

  const chainCache = stablesCache.get(cacheKey)
  if (chainCache) {
    return chainCache.get(getAddress(tokenAddress)) || null
  }

  return null
}
