import {
  IEvmWallet,
  ReadContractParams,
  WriteContractParams,
  WriteContractsOptions,
} from '@/common/interfaces/evm-wallet.interface';

export abstract class BaseEvmWallet implements IEvmWallet {
  abstract getAddress(): Promise<`0x${string}`>;

  abstract readContract(params: ReadContractParams): Promise<any>;

  abstract readContracts(params: ReadContractParams[]): Promise<any[]>;

  abstract writeContract(params: WriteContractParams): Promise<`0x${string}`>;

  abstract writeContracts(
    params: WriteContractParams[],
    options?: WriteContractsOptions,
  ): Promise<`0x${string}`[]>;
}
