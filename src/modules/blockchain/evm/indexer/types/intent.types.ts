export interface IndexedIntent {
  hash: string;
  chainId: number;
  params: any; // Will be parsed with Viem + Portal ABI
  transactionHash: string;
  blockNumber: bigint;
  blockTimestamp: bigint;
  evt_log_address: string;
  evt_log_index: number;
  from: string;
}

export interface IndexedFulfillment {
  hash: string;
  chainId: number;
  transactionHash: string;
  blockNumber: bigint;
  blockTimestamp: bigint;
  evt_log_address: string;
  evt_log_index: number;
}

export interface IndexedWithdrawal {
  hash: string;
  chainId: number;
  transactionHash: string;
  blockNumber: bigint;
  blockTimestamp: bigint;
  evt_log_address: string;
  evt_log_index: number;
}

export interface IndexedRefund {
  hash: string;
  chainId: number;
  transactionHash: string;
  blockNumber: bigint;
  blockTimestamp: bigint;
  evt_log_address: string;
  evt_log_index: number;
}
