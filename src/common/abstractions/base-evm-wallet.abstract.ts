import { Call, IEvmWallet, WriteContractsOptions } from '@/common/interfaces/evm-wallet.interface';

export abstract class BaseEvmWallet implements IEvmWallet {
  abstract getAddress(): Promise<`0x${string}`>;

  abstract writeContract(params: Call): Promise<`0x${string}`>;

  abstract writeContracts(
    params: Call[],
    options?: WriteContractsOptions,
  ): Promise<`0x${string}`[]>;
}
