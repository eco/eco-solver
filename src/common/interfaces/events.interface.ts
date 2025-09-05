import { TronWeb } from 'tronweb';
import { Hex } from 'viem';

/**
 * Base event interface for all blockchain events
 */
export interface BaseBlockchainEvent {
  /** Chain ID where the event occurred */
  chainId: bigint;
  /** Transaction hash that emitted the event */
  transactionHash: string;
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
  claimant: Hex;
}

/** TVM Event Response type helper */
export type TvmEventResponse = Awaited<ReturnType<TronWeb['event']['getEventsByContractAddress']>>;

// TvmEvent types are now exported from RawEventLogs namespace
export type TvmEvent = Extract<TvmEventResponse['data'], unknown[]>[number];
