import { anvil } from './definitions/anvil'
import { arbitrum } from './definitions/arbitrum'
import { base, baseSepolia } from './definitions/base'
import { celo, ink } from 'viem/chains'
import { Chain } from 'viem'
import { ecoSepolia } from './definitions/eco'
import { ethereum, sepolia } from './definitions/ethereum'
import { helix } from './definitions/helix'
import { mantle } from './definitions/mantle'
import { optimism, optimismSepolia } from './definitions/optimism'
import { polygon } from './definitions/polygon'
import { unichain } from './definitions/unichain'

/**
 * List of supported chains for the solver that have modified RPC URLs or are defined in the project
 */
export const ChainsSupported: Chain[] = [
  anvil,
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
  ink,
  unichain,
]
