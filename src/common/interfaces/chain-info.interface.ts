import { UniversalAddress } from '../types/universal-address.type';

export interface WalletInfo {
  type: string;
  address: string;
  metadata?: Record<string, string>;
}

export interface TokenInfo {
  address: UniversalAddress;
  decimals: number;
  symbol: string;
}

export interface ChainInfo {
  chainId: number;
  chainName?: string;
  chainType: 'EVM' | 'SVM' | 'TVM';
  wallets: WalletInfo[];
  tokens: TokenInfo[];
}
