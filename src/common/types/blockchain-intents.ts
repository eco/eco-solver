/**
 * Blockchain-Specific Intent Types
 *
 * These types represent chain-native formats for intents on different blockchains.
 * They use the native address formats and types expected by each chain.
 */

import { Address, Hex } from 'viem';

import { TronAddress } from '@/modules/blockchain/tvm/types';

/**
 * EVM Intent - Uses Viem Address types (0x prefixed, checksummed)
 */
export interface EVMIntent {
  intentHash: Hex;
  destination: bigint;
  sourceChainId?: bigint;
  route: {
    salt: Hex;
    deadline: bigint;
    portal: Address;
    nativeAmount: bigint;
    tokens: {
      amount: bigint;
      token: Address;
    }[];
    calls: {
      data: Hex;
      target: Address;
      value: bigint;
    }[];
  };
  reward: {
    deadline: bigint;
    creator: Address;
    prover: Address;
    nativeAmount: bigint;
    tokens: {
      amount: bigint;
      token: Address;
    }[];
  };
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * TVM Intent - Uses Tron address format (Base58 or hex)
 * Tron addresses can be represented as both Base58 (T-prefix) or hex format
 */
export interface TVMIntent {
  intentHash: string;
  destination: bigint;
  sourceChainId?: bigint;
  route: {
    salt: string;
    deadline: bigint;
    portal: TronAddress; // Base58 or hex Tron address
    nativeAmount: bigint;
    tokens: {
      amount: bigint;
      token: TronAddress; // Base58 or hex Tron address
    }[];
    calls: {
      data: string;
      target: TronAddress; // Base58 or hex Tron address
      value: bigint;
    }[];
  };
  reward: {
    deadline: bigint;
    creator: TronAddress; // Base58 or hex Tron address
    prover: TronAddress; // Base58 or hex Tron address
    nativeAmount: bigint;
    tokens: {
      amount: bigint;
      token: TronAddress; // Base58 or hex Tron address
    }[];
  };
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * SVM Intent - Uses Solana PublicKey format (Base58)
 */
export interface SVMIntent {
  intentHash: string;
  destination: bigint;
  sourceChainId?: bigint;
  route: {
    salt: string;
    deadline: bigint;
    portal: string; // Base58 Solana address
    nativeAmount: bigint;
    tokens: {
      amount: bigint;
      token: string; // Base58 Solana address
    }[];
    calls: {
      data: string;
      target: string; // Base58 Solana address
      value: bigint;
    }[];
  };
  reward: {
    deadline: bigint;
    creator: string; // Base58 Solana address
    prover: string; // Base58 Solana address
    nativeAmount: bigint;
    tokens: {
      amount: bigint;
      token: string; // Base58 Solana address
    }[];
  };
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
