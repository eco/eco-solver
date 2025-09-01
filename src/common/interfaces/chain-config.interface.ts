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
