import { Address, Hash, Hex } from 'viem';

export interface ReadContractParams {
  address: Address;
  abi: any;
  functionName: string;
  args?: any[];
}

export interface Call {
  to: Address;
  value?: bigint;
  data?: Hex;
}

export interface WriteContractsOptions {
  keepSender?: boolean; // If false (default), use multicall3 to batch transactions
  skipWait?: boolean;
}

export interface IEvmWallet {
  getAddress(): Promise<Address>;
  writeContract(params: Call): Promise<Hash>;
  writeContracts(params: Call[], options?: WriteContractsOptions): Promise<Hash[]>;
}
