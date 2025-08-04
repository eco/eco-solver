import { Injectable } from '@nestjs/common';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { IWalletFactory } from '@/modules/blockchain/evm/interfaces/wallet-factory.interface';
import { KernelWallet } from '@/modules/blockchain/evm/wallets';
import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from '../../services/evm-transport.service';

@Injectable()
export class KernelWalletFactory implements IWalletFactory {
  readonly name = 'kernel';

  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
  ) {}

  async createWallet(chainId: number): Promise<IEvmWallet> {
    const kernelWallet = new KernelWallet(
      chainId,
      this.evmConfigService.getKernelWalletConfig(),
      this.transportService,
    );

    await kernelWallet.init();

    return kernelWallet;
  }
}
