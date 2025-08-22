import { TronWeb } from 'tronweb';
import { Abi, ContractFunctionName } from 'viem';

import { ITvmWallet, TvmTransactionOptions } from '@/common/interfaces/tvm-wallet.interface';

export interface ContractFunctionParameter {
  type: string;
  value: unknown;
}

export abstract class BaseTvmWallet implements ITvmWallet {
  tronWeb: TronWeb;

  abstract getAddress(): Promise<string>;

  abstract sendTrx(to: string, amount: bigint): Promise<string>;

  abstract triggerSmartContract<
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
