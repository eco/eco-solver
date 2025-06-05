import { EcoRoutesChains } from '@eco-foundation/chains'
import { Chain } from 'viem'
import { b3Testnet, studioChain, toyChainTestnet } from '@metalayer/viem-chains'
import { bscTestnet, arbitrumSepolia } from 'viem/chains'

/**
 * List of supported chains for the solver that have modified RPC URLs or are defined in the project
 */
// Configure custom RPC URLs for specific chains
const configureChainRpc = (chain: Chain): Chain => {
  // Create a deep copy of the chain to avoid modifying the original
  const modifiedChain = JSON.parse(JSON.stringify(chain)) as Chain

  // Set custom RPC URL for BSC testnet
  if (modifiedChain.id === 97) {
    modifiedChain.rpcUrls.default.http = [
      'https://bnb-testnet.g.alchemy.com/v2/Pck8yx8R7BLJ6MqbVD34L',
    ]
  }

  return modifiedChain
}

// Apply the configuration to all Caldera chains
const calderaChains = [bscTestnet, arbitrumSepolia, b3Testnet, studioChain, toyChainTestnet].map(
  configureChainRpc,
)

export const ChainsSupported: Chain[] = [...(EcoRoutesChains as Chain[]), ...calderaChains]
