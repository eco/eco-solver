export interface ChainConfig {
  chainId: string | number;
  chainType: string;
  rpcUrl: string;
  websocketUrl?: string;
}

export interface EvmChainConfig extends ChainConfig {
  chainType: 'EVM';
  chainId: number;
  privateKey: string;
  intentSourceAddress: string;
  inboxAddress: string;
}

export interface SolanaChainConfig extends ChainConfig {
  chainType: 'SVM';
  chainId: string;
  secretKey: number[];
  programId: string;
}
