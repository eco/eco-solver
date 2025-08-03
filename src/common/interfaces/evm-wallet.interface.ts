import { Address, Hash } from 'viem';

export interface ReadContractParams {
  address: Address;
  abi: any;
  functionName: string;
  args?: any[];
}

export interface WriteContractParams {
  address: Address;
  abi: any;
  functionName: string;
  args?: any[];
  value?: bigint;
}

export interface WriteContractsOptions {
  keepSender?: boolean; // If false (default), use multicall3 to batch transactions
}

export interface IEvmWallet {
  getAddress(): Promise<Address>;
  readContract(params: ReadContractParams): Promise<any>;
  readContracts(params: ReadContractParams[]): Promise<any[]>;
  writeContract(params: WriteContractParams): Promise<Hash>;
  writeContracts(params: WriteContractParams[], options?: WriteContractsOptions): Promise<Hash[]>;
}
