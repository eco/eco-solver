import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

// Discriminated union of all job types
export type ExecutionJobData =
  | StandardExecutionJob
  | RhinestoneClaimJob
  | RhinestoneFillJob
  | RhinestoneProveJob;

// Standard execution (unchanged behavior, keeps full Intent)
export interface StandardExecutionJob {
  type: 'standard';
  strategy: FulfillmentStrategyName;
  intent: Intent;
  chainId: bigint;
  walletId?: WalletType;
}

// Rhinestone Claim: Funds single intent on source chain
export interface RhinestoneClaimJob {
  type: 'rhinestone-claim';
  intentHash: Hex;
  chainId: bigint; // Source chain
  transaction: {
    to: Address;
    data: Hex;
    value: bigint;
  };
  messageId: string; // For preconfirmation callback
  walletId?: WalletType;
}

// Rhinestone Fill: Fulfills ALL intents on destination chain
export interface RhinestoneFillJob {
  type: 'rhinestone-fill';
  intents: Intent[]; // Full intent objects (needed for prove job creation after fill)
  chainId: bigint; // Destination chain
  transaction: {
    to: Address;
    data: Hex;
    value: bigint;
  };
  requiredApprovals: Array<{
    // Pre-calculated token approvals (sum across all batched fills)
    token: Address;
    amount: bigint;
  }>;
  messageId: string;
  walletId?: WalletType;
}

// Rhinestone Prove: Generates proof for single intent
export interface RhinestoneProveJob {
  type: 'rhinestone-prove';
  intent: Intent; // Full intent object (needed for proof generation, no DB query)
  chainId: bigint; // Destination chain (where prove executes)
  walletId?: WalletType;
  messageId: string;
}
