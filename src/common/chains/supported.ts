import { Chain } from 'viem'
import { ecoSepolia } from './definitions/eco'
import { helix } from './definitions/helix'
import { optimism, optimismSepolia } from './definitions/optimism'
import { base, baseSepolia } from './definitions/base'
import { arbitrum } from './definitions/arbitrum'
import { mantle } from './definitions/mantle'
import { polygon } from './definitions/polygon'
import { ethereum, sepolia } from './definitions/ethereum'
import { celo } from './definitions/celo'

/**
 * List of supported chains for the solver that have modified RPC URLs or are defined in the project
 */
export const ChainsSupported: Chain[] = [
  optimism,
  optimismSepolia,
  base,
  baseSepolia,
  ecoSepolia,
  helix,
  arbitrum,
  mantle,
  polygon,
  ethereum,
  sepolia,
  celo,
]
