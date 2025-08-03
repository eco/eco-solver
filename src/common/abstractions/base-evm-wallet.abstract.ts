import { PublicClient, WalletClient } from 'viem';

import {
  IEvmWallet,
  ReadContractParams,
  WriteContractParams,
  WriteContractsOptions,
} from '@/common/interfaces/evm-wallet.interface';

export abstract class BaseEvmWallet implements IEvmWallet {
  protected publicClient: PublicClient;
  protected walletClient: WalletClient;

  constructor(publicClient: PublicClient, walletClient: WalletClient) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  abstract getAddress(): Promise<`0x${string}`>;
  abstract readContract(params: ReadContractParams): Promise<any>;
  abstract readContracts(params: ReadContractParams[]): Promise<any[]>;
  abstract writeContract(params: WriteContractParams): Promise<`0x${string}`>;
  abstract writeContracts(
    params: WriteContractParams[],
    options?: WriteContractsOptions,
  ): Promise<`0x${string}`[]>;
}
