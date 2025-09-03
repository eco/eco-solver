/**
 * Blockchain-Specific Intent Types
 *
 * These types represent chain-native formats for intents on different blockchains.
 * They use the native address formats and types expected by each chain.
 */

import { BlockchainIntent } from '@/common/interfaces/intent.interface';
import { ChainType } from '@/common/utils/chain-type-detector';

/**
 * EVM Intent - Uses Viem Address types (0x prefixed, checksummed)
 */
export type EVMIntent = BlockchainIntent<ChainType.EVM, ChainType.EVM>;

/**
 * TVM Intent - Uses Tron address format (Base58 or hex)
 * Tron addresses can be represented as both Base58 (T-prefix) or hex format
 */
export type TVMIntent = BlockchainIntent<ChainType.TVM, ChainType.TVM>;

/**
 * SVM Intent - Uses Solana PublicKey format (Base58)
 */
export type SVMIntent = BlockchainIntent<ChainType.SVM, ChainType.SVM>;
