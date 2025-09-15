import {
  EvmCall,
  IEvmWallet,
  WriteContractsOptions,
} from '@/common/interfaces/evm-wallet.interface';

export abstract class BaseEvmWallet implements IEvmWallet {
  abstract getAddress(): Promise<`0x${string}`>;

  abstract writeContract(params: EvmCall): Promise<`0x${string}`>;

  abstract writeContracts(
    params: EvmCall[],
    options?: WriteContractsOptions,
  ): Promise<`0x${string}`[]>;
}
