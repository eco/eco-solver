// Blockchain service interface
import { ChainId, Address, Hash } from '../types';

export interface IBlockchainService {
  getBalance(address: Address, chainId: ChainId): Promise<string>;
  getTransactionReceipt(hash: Hash): Promise<any>;
}