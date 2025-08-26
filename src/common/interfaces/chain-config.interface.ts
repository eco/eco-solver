import { Address } from 'viem';

export interface ChainConfig {
  chainId: string | number;
  chainType: string;
}

export interface EvmChainConfig extends ChainConfig {
  chainType: 'EVM';
  chainId: number;
  portalAddress: Address;
}

export interface SolanaChainConfig extends ChainConfig {
  chainType: 'SVM';
  chainId: string;
  secretKey: number[];
  programId: string;
}
