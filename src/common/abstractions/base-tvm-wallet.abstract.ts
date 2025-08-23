import { TronWeb } from 'tronweb';
import { Abi, ContractFunctionName } from 'viem';

import {
  ContractFunctionParameter,
  ITvmWallet,
  TvmTransactionOptions,
} from '@/common/interfaces/tvm-wallet.interface';

/**
 * Base abstract class for TVM wallet implementations
 */
export abstract class BaseTvmWallet implements ITvmWallet {
  abstract readonly tronWeb: TronWeb;

  abstract getAddress(): Promise<string>;

  abstract sendTrx(to: string, amount: bigint): Promise<string>;

  abstract triggerSmartContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, 'payable' | 'nonpayable'>,
  >(
    contractAddress: string,
    abi: abi,
    functionName: functionName,
    parameter: ContractFunctionParameter[],
    options?: TvmTransactionOptions,
  ): Promise<string>;

  abstract approveTrc20(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint,
    options?: TvmTransactionOptions,
  ): Promise<string>;

  abstract transferTrc20(
    tokenAddress: string,
    toAddress: string,
    amount: bigint,
    options?: TvmTransactionOptions,
  ): Promise<string>;
}
