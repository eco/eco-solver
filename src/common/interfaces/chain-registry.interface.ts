import { Address } from 'viem';
import { Intent } from '@/common/interfaces/intent.interface';

/**
 * Chain metadata for registration
 */
export interface ChainMetadata {
  chainId: bigint;
  name: string;
  type: 'evm' | 'svm';
  enabled: boolean;
  rpcUrls?: string[];
}

/**
 * Base chain reader interface
 * All chain implementations must implement this contract
 */
export interface IChainReader {
  readonly chainId: bigint;
  readonly chainType: 'evm' | 'svm';
  
  getBalance(address: Address | string): Promise<bigint>;
  getTokenBalance(tokenAddress: Address | string, walletAddress: Address | string): Promise<bigint>;
  isAddressValid(address: string): boolean;
  isIntentFunded(intent: Intent): Promise<boolean>;
}

/**
 * Chain registry for managing blockchain implementations
 * Follows Open/Closed and Dependency Inversion principles
 */
export interface IChainRegistry {
  register(reader: IChainReader, metadata: ChainMetadata): void;
  unregister(chainId: bigint): void;
  getReader(chainId: bigint): IChainReader | undefined;
  getAllReaders(): Map<bigint, IChainReader>;
  isChainSupported(chainId: bigint): boolean;
  getChainType(chainId: bigint): 'evm' | 'svm' | undefined;
}

/**
 * Chain factory interface for creating chain readers
 */
export interface IChainFactory {
  create(chainId: bigint): IChainReader;
  supports(chainId: bigint): boolean;
}