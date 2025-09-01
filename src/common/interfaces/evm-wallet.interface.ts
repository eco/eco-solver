import { Address, Hash, Hex } from 'viem';

export interface Call {
  to: Address;
  value?: bigint;
  data?: Hex;
}

export interface WriteContractsOptions {
  value?: bigint; // If not defined, it's equal to the sum of values from txs
  keepSender?: boolean; // If false (default), use multicall3 to batch transactions
  skipWait?: boolean;
}

export interface IEvmWallet {
  getAddress(): Promise<Address>;

  writeContract(params: Call): Promise<Hash>;

  writeContracts(params: Call[], options?: WriteContractsOptions): Promise<Hash[]>;
}
