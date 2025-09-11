import { Hex } from 'viem';

import { UniversalAddress } from '@/common/types/universal-address.type';

/**
 * Base event interface for all blockchain events
 */
export interface BaseBlockchainEvent {
  /** Chain ID where the event occurred */
  chainId: bigint;
  /** Transaction hash that emitted the event */
  transactionHash: string;
  /** Timestamp when the event was emitted */
  timestamp: Date;
  /** Block number (optional as some chains like Solana don't use block numbers) */
  blockNumber?: bigint;
}

/**
 * IntentFulfilled event data structure
 * Emitted when an intent is successfully fulfilled on the destination chain
 */
export interface IntentFulfilledEvent extends BaseBlockchainEvent {
  /** Hash of the fulfilled intent */
  intentHash: Hex;
  /** Address/identifier of the claimant who fulfilled the intent */
  claimant: UniversalAddress;
}

export interface IntentProvenEvent extends BaseBlockchainEvent {
  /** Hash of the intent */
  intentHash: Hex;
  /** Address/identifier of the claimant who fulfilled the intent */
  claimant: UniversalAddress;
}

export interface IntentWithdrawnEvent extends BaseBlockchainEvent {
  /** Hash of the intent */
  intentHash: Hex;
  /** Address/identifier of the claimant who fulfilled the intent */
  claimant: UniversalAddress;
}
