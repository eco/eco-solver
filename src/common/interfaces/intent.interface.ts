export interface Intent {
  intentId: string;
  sourceChainId: string | number;
  targetChainId: string | number;
  solver: string;
  user: string;
  source: string;
  target: string;
  data: string;
  value: string;
  reward: string;
  deadline: number;
  timestamp: number;
  status: IntentStatus;
  txHash?: string;
  fulfillmentTxHash?: string;
}

export enum IntentStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  EXECUTING = 'EXECUTING',
  FULFILLED = 'FULFILLED',
  FAILED = 'FAILED',
}
