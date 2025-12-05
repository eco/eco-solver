import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';

import { FulfillmentStrategyName } from '../types/strategy-name.type';

// Standard fulfillment job (single intent)
export interface StandardFulfillmentJob {
  type: 'standard'; // Discriminator
  strategy: FulfillmentStrategyName;
  intent: Intent;
  chainId: number;
}

// Rhinestone action job (per WebSocket message, multi-intent)
export interface RhinestoneActionFulfillmentJob {
  type: 'rhinestone-action'; // Discriminator
  strategy: 'rhinestone'; // Always rhinestone strategy
  messageId: string; // WebSocket message ID
  actionId: string; // Rhinestone action ID

  // All claims in this action
  claims: Array<{
    intent: Intent; // Full intent for validation
    intentHash: Hex;
    chainId: bigint;
    transaction: {
      to: Address;
      data: Hex;
      value: bigint;
    };
    metadata?: {
      settlementLayer?: string; // For validation in strategy
    };
  }>;

  // Single fill for all claims
  fill: {
    intents: Intent[]; // Full intents (needed for prove job creation)
    chainId: bigint;
    transaction: {
      to: Address;
      data: Hex;
      value: bigint;
    };
    requiredApprovals: Array<{
      token: Address;
      amount: bigint;
    }>;
  };

  walletId?: string;
}

// Discriminated union type (like ExecutionJobData)
export type FulfillmentJobData = StandardFulfillmentJob | RhinestoneActionFulfillmentJob;
