import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';

export interface IWalletFactory {
  readonly name: WalletType;
  createWallet(chainId: number): Promise<IEvmWallet>;
}
