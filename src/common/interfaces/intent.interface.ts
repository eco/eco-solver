import { Address, Hex } from 'viem';

export interface Intent {
  intentId: string;
  reward: {
    prover: Address;
    creator: Address;
    deadline: bigint;
    nativeValue: bigint;
    tokens: {
      amount: bigint;
      token: Address;
    }[];
  };
  route: {
    source: bigint;
    destination: bigint;
    salt: Hex;
    inbox: Address;
    calls: {
      data: Hex;
      target: Address;
      value: bigint;
    }[];
    tokens: {
      amount: bigint;
      token: Address;
    }[];
  };
  status: IntentStatus;
  metadata?: {
    strategyType?: string;
    useSmartAccount?: boolean;
    isNegativeIntent?: boolean;
    isNativeToken?: boolean;
    useCrowdLiquidity?: boolean;
    [key: string]: any;
  };
}

export enum IntentStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  EXECUTING = 'EXECUTING',
  FULFILLED = 'FULFILLED',
  FAILED = 'FAILED',
}
