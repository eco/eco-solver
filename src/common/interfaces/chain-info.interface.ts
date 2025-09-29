export interface WalletInfo {
  type: string;
  address: string;
  metadata?: Record<string, string>;
}

export interface ChainInfo {
  chainId: number;
  chainName?: string;
  chainType: 'EVM' | 'SVM' | 'TVM';
  wallets: WalletInfo[];
}
