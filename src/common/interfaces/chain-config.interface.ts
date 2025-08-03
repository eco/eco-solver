import { Address } from 'viem';

export interface ChainConfig {
  chainId: string | number;
  chainType: string;
}

export interface EvmChainConfig extends ChainConfig {
  chainType: 'EVM';
  chainId: number;
  inboxAddress: Address;
  intentSourceAddress: Address;
}

export interface SolanaChainConfig extends ChainConfig {
  chainType: 'SVM';
  chainId: string;
  secretKey: number[];
  programId: string;
}
