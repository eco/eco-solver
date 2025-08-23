import { TronWeb } from 'tronweb';
import { Abi, ContractFunctionName } from 'viem';

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
  getAddress(): Promise<string>;

  /**
   * Sends TRX to another address
   * @param to - Recipient address
   * @param amount - Amount in SUN (1 TRX = 1,000,000 SUN)
   * @returns Transaction ID
   */
  sendTrx(to: string, amount: bigint): Promise<string>;

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

  /**
   * Approves TRC20 tokens for spending
   * @param tokenAddress - The token contract address
   * @param spenderAddress - The spender address
   * @param amount - Amount to approve
   * @param options - Transaction options
   * @returns Transaction ID
   */
  approveTrc20(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint,
    options?: TvmTransactionOptions,
  ): Promise<string>;

  /**
   * Transfers TRC20 tokens
   * @param tokenAddress - The token contract address
   * @param toAddress - The recipient address
   * @param amount - Amount to transfer
   * @param options - Transaction options
   * @returns Transaction ID
   */
  transferTrc20(
    tokenAddress: string,
    toAddress: string,
    amount: bigint,
    options?: TvmTransactionOptions,
  ): Promise<string>;
}