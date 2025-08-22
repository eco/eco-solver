import { TronWeb } from 'tronweb';
import { Abi, ContractFunctionName } from 'viem';

import { ContractFunctionParameter } from '@/common/abstractions/base-tvm-wallet.abstract';

export interface TvmCall {
  to: string; // Tron address (base58 format)
  value?: bigint; // Amount in SUN
  functionSelector?: string; // Function signature for smart contract calls
  parameter?: any[]; // Parameters for the function call
  feeLimit?: number; // Fee limit in SUN
}

export interface TvmTransactionOptions {
  feeLimit?: number; // Maximum fee in SUN
  callValue?: number; // Amount to send with contract call
  tokenId?: string; // Token ID for TRC10 transfers
  tokenValue?: number; // Amount of TRC10 tokens
  permissionId?: number; // Multi-signature permission ID
}

export interface ITvmWallet {
  tronWeb: TronWeb;

  getAddress(): Promise<string>; // Returns base58 Tron address
  sendTrx(to: string, amount: bigint): Promise<string>; // Send TRX

  triggerSmartContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, 'payable' | 'nonpayable'>,
  >(
    contractAddress: string,
    abi: abi,
    functionSelector: functionName,
    parameter: ContractFunctionParameter[],
    options?: TvmTransactionOptions,
  ): Promise<string>;
}
