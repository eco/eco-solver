export interface ProverRoute {
  source: {
    chainId: string | number;
    contract: string;
  };
  target: {
    chainId: string | number;
    contract: string;
  };
  intentId: string;
}

export interface ProverResult {
  isValid: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface ProverChainConfig {
  chainId: string | number;
  contractAddress: string;
}

export interface ProverConfig {
  type: string;
  chainConfigs: ProverChainConfig[];
}

export enum ProverType {
  HYPER = 'hyper',
  METALAYER = 'metalayer',
}
