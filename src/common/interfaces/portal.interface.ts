/**
 * Portal Contract Interface Definitions
 *
 * Defines interfaces specific to Portal contract interactions,
 * including events, function parameters, and integration modes.
 */

import { Address, Hex } from 'viem';

import { ChainType } from '../utils/chain-type-detector';

/**
 * Portal Integration Modes
 */
export enum PortalIntegrationMode {
  PUBLIC = 'public', // Call publish() to emit events for solver discovery
  PRIVATE = 'private', // Share intent data off-chain with specific solvers
  DIRECT = 'direct', // Fund vaults directly without Portal interaction
}

/**
 * Portal Event Types
 */
export interface IntentPublishedEvent {
  intentHash: Hex;
  destination: bigint;
  route: Buffer; // Encoded route data
  creator: Address;
  prover: Address;
  rewardDeadline: bigint;
  rewardNativeAmount: bigint;
  rewardTokens: Array<{ token: Address; amount: bigint }>;
}

export interface IntentFundedEvent {
  intentHash: Hex;
  funder: Address;
  complete: boolean;
}

export interface IntentFulfilledEvent {
  intentHash: Hex;
  claimant: Address;
}

export interface IntentProvenEvent {
  intentHash: Hex;
  claimant: Address;
}

export interface IntentWithdrawnEvent {
  intentHash: Hex;
  claimant: Address;
}

export interface IntentRefundedEvent {
  intentHash: Hex;
  refundee: Address;
}

/**
 * Portal Function Parameters
 */
export interface PublishParams {
  destination: bigint;
  route: {
    salt: Hex;
    deadline: bigint;
    portal: Address;
    tokens: Array<{ token: Address; amount: bigint }>;
    calls: Array<{ target: Address; data: Hex; value: bigint }>;
  };
  reward: {
    deadline: bigint;
    creator: Address;
    prover: Address;
    nativeAmount: bigint;
    tokens: Array<{ token: Address; amount: bigint }>;
  };
}

export interface FundParams {
  destination: bigint;
  routeHash: Hex;
  reward: {
    deadline: bigint;
    creator: Address;
    prover: Address;
    nativeAmount: bigint;
    tokens: Array<{ token: Address; amount: bigint }>;
  };
  allowPartial: boolean;
}

export interface FulfillParams {
  intentHash: Hex;
  route: {
    salt: Hex;
    deadline: bigint;
    portal: Address;
    tokens: Array<{ token: Address; amount: bigint }>;
    calls: Array<{ target: Address; data: Hex; value: bigint }>;
  };
  rewardHash: Hex;
  claimant: Address;
}

export interface ProveParams {
  prover: Address;
  sourceChainDomainID: bigint;
  intentHashes: Hex[];
  data: Hex;
}

export interface WithdrawParams {
  destination: bigint;
  routeHash: Hex;
  reward: {
    deadline: bigint;
    creator: Address;
    prover: Address;
    nativeAmount: bigint;
    tokens: Array<{ token: Address; amount: bigint }>;
  };
}

export interface RefundParams {
  destination: bigint;
  routeHash: Hex;
  reward: {
    deadline: bigint;
    creator: Address;
    prover: Address;
    nativeAmount: bigint;
    tokens: Array<{ token: Address; amount: bigint }>;
  };
}

/**
 * Portal Chain Configuration
 */
export interface PortalChainConfig {
  chainId: string | number | bigint;
  chainType: ChainType;
  portalAddress: string;
  rpcEndpoint: string;
  isEnabled: boolean;
}

/**
 * Vault Information
 */
export interface VaultInfo {
  address: string;
  chainType: ChainType;
  intentHash: Hex;
  nativeBalance: bigint;
  tokenBalances: Array<{
    token: Address;
    balance: bigint;
  }>;
  isFullyFunded: boolean;
}

/**
 * Portal Hash Components
 */
export interface HashComponents {
  destination: bigint;
  routeHash: Hex;
  rewardHash: Hex;
  intentHash: Hex;
}

/**
 * Cross-chain Intent Context
 */
export interface CrossChainContext {
  sourceChainId: bigint;
  sourceChainType: ChainType;
  destinationChainId: bigint;
  destinationChainType: ChainType;
  sourcePortalAddress: string;
  destinationPortalAddress: string;
}

/**
 * Portal Transaction Result
 */
export interface PortalTransactionResult {
  transactionHash: string;
  blockNumber?: number;
  gasUsed?: bigint;
  status: 'success' | 'failed' | 'pending';
  events?: Array<{
    eventName: string;
    args: Record<string, any>;
  }>;
}

/**
 * Portal Monitoring Configuration
 */
export interface PortalMonitoringConfig {
  enableVaultMonitoring: boolean;
  enableEventMonitoring: boolean;
  pollingInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
}
