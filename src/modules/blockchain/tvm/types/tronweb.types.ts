// TronWeb type definitions for better type inference
export interface TronWebContract {
  [methodName: string]: (...args: any[]) => Promise<any>;
}

export interface TronWebTransactionInfo {
  blockNumber?: number;
  blockTimeStamp?: number;
  contractResult?: string[];
  contract_address?: string;
  receipt?: {
    result?: string;
    energy_usage?: number;
    energy_usage_total?: number;
    net_usage?: number;
    net_fee?: number;
  };
  log?: any[];
  result?: string;
  resMessage?: string;
}

export interface TronWebTransactionResult {
  result?: boolean;
  txid?: string;
  transaction?: any;
  message?: string;
}

export interface TronWebEventResult {
  event_name?: string;
  block_number?: number;
  block_timestamp?: number;
  transaction_id?: string;
  result?: Record<string, any>;
}

export interface TronWebAccountResources {
  freeNetUsed?: number;
  freeNetLimit?: number;
  NetUsed?: number;
  NetLimit?: number;
  EnergyUsed?: number;
  EnergyLimit?: number;
}

export interface TronWebBlock {
  block_header?: {
    raw_data?: {
      number?: number;
      timestamp?: number;
      witness_address?: string;
    };
  };
  transactions?: any[];
}