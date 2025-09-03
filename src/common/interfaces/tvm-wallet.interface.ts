import { TronWeb } from 'tronweb';
import { Abi, ContractFunctionName } from 'viem';

import { TronAddress } from '@/modules/blockchain/tvm/types';

/**
 * Contract function parameter type
 */
export interface ContractFunctionParameter {
  type: string;
  value: unknown;
}

/**
 * Transaction options for TVM operations
 */
export interface TvmTransactionOptions {
  feeLimit?: number;
  callValue?: number;
  tokenValue?: number;
  tokenId?: number;
  permissionId?: number;
}

/**
 * Interface for TVM wallet implementations
 */
export interface ITvmWallet {
  /**
   * The TronWeb instance used by this wallet
   */
  readonly tronWeb: TronWeb;

  /**
   * Gets the wallet address
   * @returns The wallet address in base58 format
   */
  getAddress(): Promise<TronAddress>;

  /**
   * Triggers a smart contract function
   * @param contractAddress - The contract address
   * @param abi - The contract ABI
   * @param functionName - The function to call
   * @param parameter - Function parameters
   * @param options - Transaction options
   * @returns Transaction ID
   */
  triggerSmartContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, 'payable' | 'nonpayable'>,
  >(
    contractAddress: string,
    abi: abi,
    functionName: functionName,
    parameter: ContractFunctionParameter[],
    options?: TvmTransactionOptions,
  ): Promise<string>;
}
