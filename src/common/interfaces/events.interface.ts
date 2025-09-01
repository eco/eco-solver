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

  /** TVM/Tron raw event structure */
  export interface TvmEvent {
    event_name: string;
    transaction_id: string;
    block_number?: string;
    result: Record<string, any>;
  }

  /** SVM/Solana raw logs structure */
  export interface SvmLogs {
    signature: string;
    logs: string[];
    err?: any;
  }
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

/**
 * Type guards for event types
 */
export const EventTypeGuards = {
  isIntentFulfilledEvent(event: any): event is IntentFulfilledEvent {
    return (
      event &&
      typeof event.intentHash === 'string' &&
      typeof event.claimant === 'string' &&
      typeof event.chainId === 'bigint' &&
      typeof event.transactionHash === 'string'
    );
  },

  isEvmLog(log: any): log is RawEventLogs.EvmLog {
    return (
      log &&
      typeof log.address === 'string' &&
      Array.isArray(log.topics) &&
      typeof log.data === 'string' &&
      typeof log.transactionHash === 'string'
    );
  },

  isTvmEvent(event: any): event is RawEventLogs.TvmEvent {
    return (
      event &&
      typeof event.event_name === 'string' &&
      typeof event.transaction_id === 'string' &&
      typeof event.result === 'object'
    );
  },

  isSvmLogs(logs: any): logs is RawEventLogs.SvmLogs {
    return (
      logs &&
      typeof logs.signature === 'string' &&
      Array.isArray(logs.logs)
    );
  },
};