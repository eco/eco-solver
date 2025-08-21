import { ITvmWallet, TvmTransactionOptions } from '@/common/interfaces/tvm-wallet.interface';

export abstract class BaseTvmWallet implements ITvmWallet {
  abstract getAddress(): Promise<string>;

  abstract sendTrx(to: string, amount: bigint): Promise<string>;

  abstract triggerSmartContract(
    contractAddress: string,
    functionSelector: string,
    parameter: any[],
    options?: TvmTransactionOptions,
  ): Promise<string>;
}