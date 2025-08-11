// Wallet client service interface
import { LocalAccount } from 'viem/accounts';

export interface IWalletClientService {
  getAccount(): Promise<LocalAccount>;
  signMessage(message: string): Promise<string>;
}