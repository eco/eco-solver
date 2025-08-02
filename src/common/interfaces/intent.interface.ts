export interface Intent {
  intentId: string;
  source: {
    chainId: string | number;
    address: string;
    txHash?: string;
  };
  target: {
    chainId: string | number;
    address: string;
    txHash?: string;
  };
  solver: string;
  user: string;
  data: string;
  value: string;
  reward: string;
  deadline: number;
  timestamp: number;
  status: IntentStatus;
}

export enum IntentStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  EXECUTING = 'EXECUTING',
  FULFILLED = 'FULFILLED',
  FAILED = 'FAILED',
}
