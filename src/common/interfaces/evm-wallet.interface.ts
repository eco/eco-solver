import { Address, Hash, Hex } from 'viem';

export interface EvmCall {
  to: Address;
  value?: bigint;
  data?: Hex;
}

export interface WriteContractsOptions {
  value?: bigint; // If not defined, it's equal to the sum of values from txs
  keepSender?: boolean; // If false (default), use multicall3 to batch transactions
  skipWait?: boolean;
  gas?: bigint; // Gas limit for the transaction
}

export interface IEvmWallet {
  getAddress(): Promise<Address>;

  writeContract(params: EvmCall): Promise<Hash>;

  writeContracts(params: EvmCall[], options?: WriteContractsOptions): Promise<Hash[]>;
}
