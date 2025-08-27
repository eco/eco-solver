import { Address, Hex } from 'viem';

export interface Intent {
  intentHash: Hex; // Changed from intentHash for consistency
  destination: bigint; // Target chain ID (moved from route)
  route: Readonly<{
    salt: Hex;
    deadline: bigint; // Added deadline to route (Portal structure)
    portal: Address; // Changed from inbox
    nativeAmount: bigint; // Changed from nativeAmount
    tokens: Readonly<
      {
        amount: bigint;
        token: Address;
      }[]
    >;
    calls: Readonly<
      {
        data: Hex;
        target: Address;
        value: bigint;
      }[]
    >;
  }>;
  reward: Readonly<{
    deadline: bigint;
    creator: Address;
    prover: Address;
    nativeAmount: bigint; // Changed from nativeAmount
    tokens: Readonly<
      {
        amount: bigint;
        token: Address;
      }[]
    >;
  }>;
  status?: IntentStatus;
  // Additional fields for Portal integration
  sourceChainId?: bigint; // Source chain context
  vaultAddress?: string; // Derived vault address
}

export enum IntentStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  EXECUTING = 'EXECUTING',
  FULFILLED = 'FULFILLED',
  FAILED = 'FAILED',
  // Additional Portal-specific statuses
  PUBLISHED = 'PUBLISHED', // Intent published to Portal
  FUNDED = 'FUNDED', // Vault funded
  PROVEN = 'PROVEN', // Cross-chain proof submitted
}

/**
 * Token amount structure for Portal compatibility
 */
export interface TokenAmount {
  token: Address;
  amount: bigint;
}

/**
 * Call structure for Portal compatibility
 */
export interface Call {
  target: Address;
  data: Hex;
  value: bigint;
}

/**
 * Portal Route structure (matches Portal ABI)
 */
export interface PortalRoute {
  salt: Hex;
  deadline: bigint;
  portal: Address;
  tokens: TokenAmount[];
  calls: Call[];
}

/**
 * Portal Reward structure (matches Portal ABI)
 */
export interface PortalReward {
  deadline: bigint;
  creator: Address;
  prover: Address;
  nativeAmount: bigint;
  tokens: TokenAmount[];
}
