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

/**
 * Event payload for intent.discovered event
 */
export interface IntentDiscoveredEventPayload {
  intent: import('./intent.interface').Intent;
  strategy: string;
}

/** TVM Event Response type helper */
export type TvmEventResponse = Awaited<ReturnType<TronWeb['event']['getEventsByContractAddress']>>;

/**
 * Raw event log types for different blockchains
 */
export namespace RawEventLogs {
  /** EVM raw log structure from viem */
  export interface EvmLog {
    address: Hex;
    topics: readonly Hex[];
    data: Hex;
    blockNumber?: bigint;
    transactionHash: Hex;
    transactionIndex?: number;
    blockHash?: Hex;
    logIndex?: number;
    removed?: boolean;
  }

  /** SVM/Solana raw logs structure */
  export interface SvmLogs {
    signature: string;
    logs: string[];
    err?: any;
  }

  /** TVM/Tron event structure */
  export type TvmEvent = Extract<TvmEventResponse['data'], unknown[]>[number];
}

/**
 * Parsed event args for Portal contract events
 */
export namespace PortalEventArgs {
  export interface IntentPublished {
    intentHash: Hex;
    destination: bigint;
    route: Hex;
    creator: Hex;
    prover: Hex;
    rewardDeadline: bigint;
    rewardNativeAmount: bigint;
    rewardTokens: Array<{
      token: Hex;
      amount: bigint;
    }>;
  }

  export interface IntentFulfilled {
    intentHash: Hex;
    claimant: Hex;
  }
}

// TvmEvent types are now exported from RawEventLogs namespace
export type TvmEvent = RawEventLogs.TvmEvent;
