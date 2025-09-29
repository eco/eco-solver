import * as viemChains from 'viem/chains';
import { Chain } from 'viem/chains';

import { ChainType } from './chain-type-detector';

const evmChains: Chain[] = Object.values(viemChains);

// Solana chain names based on chain ID
const SOLANA_CHAINS: Record<number, string> = {
  1399811149: 'Solana',
  1399811150: 'Solana Devnet',
  1399811151: 'Solana Testnet',
};

// TRON chain names based on chain ID
const TRON_CHAINS: Record<number, string> = {
  728126428: 'TRON Mainnet',
  2494104990: 'TRON Shasta Testnet',
  3448148188: 'TRON Nile Testnet',
};

/**
 * Get the chain name for a given chain ID and type
 * @param chainId The chain ID
 * @param chainType The type of blockchain (EVM, SVM, TVM)
 * @returns The chain name or undefined if not found
 */
export function getChainName(chainId: number, chainType: ChainType): string | undefined {
  switch (chainType) {
    case ChainType.EVM:
      // Find the chain by ID in Viem's exported chains
      return evmChains.find((evmChain) => evmChain.id === chainId)?.name;

    case ChainType.SVM:
      return SOLANA_CHAINS[chainId];

    case ChainType.TVM:
      return TRON_CHAINS[chainId];

    default:
      return undefined;
  }
}
