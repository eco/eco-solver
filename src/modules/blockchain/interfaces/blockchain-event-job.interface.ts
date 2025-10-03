export type BlockchainEventType =
  | 'IntentPublished'
  | 'IntentFunded'
  | 'IntentFulfilled'
  | 'IntentWithdrawn'
  | 'IntentProven';

export type ChainType = 'evm' | 'svm' | 'tvm';

export type ContractName = 'portal' | 'prover';

export interface BlockchainEventJob {
  eventType: BlockchainEventType;
  chainId: number;
  chainType: ChainType;
  contractName: ContractName;
  intentHash: string; // Required for job ID generation
  eventData: any; // Raw event data (Log for EVM, parsed event for Solana/Tron)
  metadata: {
    txHash?: string;
    blockNumber?: number | bigint;
    logIndex?: number;
    contractAddress?: string; // Actual contract address
    proverType?: string; // For prover events
    timestamp?: number;
  };
}
