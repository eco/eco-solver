import { Hex } from 'viem';

import { UniversalAddress } from '@/common/types/universal-address.type';

export interface Intent {
  intentHash: Hex; // Changed from intentHash for consistency
  destination: bigint; // Target chain ID (moved from route)
  route: Readonly<{
    salt: Hex;
    deadline: bigint; // Added deadline to route (Portal structure)
    portal: UniversalAddress; // Changed from inbox
    nativeAmount: bigint; // Changed from nativeAmount
    tokens: Readonly<
      {
        amount: bigint;
        token: UniversalAddress;
      }[]
    >;
    calls: Readonly<
      {
        data: Hex;
        target: UniversalAddress;
        value: bigint;
      }[]
    >;
  }>;
  reward: Readonly<{
    deadline: bigint;
    creator: UniversalAddress;
    prover: UniversalAddress;
    nativeAmount: bigint;
    tokens: Readonly<
      {
        amount: bigint;
        token: UniversalAddress;
      }[]
    >;
  }>;
  status?: IntentStatus;
  // Additional fields for Portal integration
  sourceChainId: bigint; // Source chain context
  vaultAddress?: string; // Derived vault address
  // Transaction tracking
  publishTxHash?: string; // Transaction hash where intent was published
}

export enum IntentStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  EXECUTING = 'EXECUTING',
  FULFILLED = 'FULFILLED',
  FAILED = 'FAILED',
}
