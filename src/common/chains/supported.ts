import { EcoRoutesChains } from '@eco-foundation/chains'
import { anvil } from './definitions/anvil'

import { Chain } from 'viem'

/**
 * List of supported chains for the solver that have modified RPC URLs or are defined in the project
 */
export const ChainsSupported: Chain[] = [anvil, ...(EcoRoutesChains as Chain[])]
