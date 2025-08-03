import { Address, Hex } from 'viem';

export interface Intent {
  intentHash: string;
  reward: Readonly<{
    prover: Address;
    creator: Address;
    deadline: bigint;
    nativeValue: bigint;
    tokens: Readonly<
      {
        amount: bigint;
        token: Address;
      }[]
    >;
  }>;
  route: Readonly<{
    source: bigint;
    destination: bigint;
    salt: Hex;
    inbox: Address;
    calls: Readonly<
      {
        data: Hex;
        target: Address;
        value: bigint;
      }[]
    >;
    tokens: Readonly<
      {
        amount: bigint;
        token: Address;
      }[]
    >;
  }>;
  status?: IntentStatus;
}

export enum IntentStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  EXECUTING = 'EXECUTING',
  FULFILLED = 'FULFILLED',
  FAILED = 'FAILED',
}
