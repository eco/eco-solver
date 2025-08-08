import { Injectable } from '@nestjs/common';

import { Hex, LocalAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { IWalletFactory } from '@/modules/blockchain/evm/interfaces/wallet-factory.interface';
import { KernelWallet } from '@/modules/blockchain/evm/wallets';
import { kmsToAccount } from '@/modules/blockchain/evm/wallets/kernel-wallet/kms/kms-account';
import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from '../../services/evm-transport.service';

@Injectable()
export class KernelWalletFactory implements IWalletFactory {
  readonly name = 'kernel';
  private signerPromise: Promise<LocalAccount> | null = null;

  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
  ) {}

  async createWallet(chainId: number): Promise<IEvmWallet> {
    // Lazy initialization with promise caching to prevent race conditions
    if (!this.signerPromise) {
      this.signerPromise = this.getWallet();
    }

    const signer = await this.signerPromise;

    const kernelWallet = new KernelWallet(
      chainId,
      signer,
      this.evmConfigService.getKernelWalletConfig(),
      this.transportService,
    );

    await kernelWallet.init();

    return kernelWallet;
  }

  private getWallet(): Promise<LocalAccount> {
    const kernelWalletConfig = this.evmConfigService.getKernelWalletConfig();

    switch (kernelWalletConfig.signer.type) {
      case 'eoa':
        return Promise.resolve(privateKeyToAccount(kernelWalletConfig.signer.privateKey as Hex));
      case 'kms':
        return kmsToAccount(kernelWalletConfig.signer);
      default:
        throw new Error(`Unsupported signer type: ${(kernelWalletConfig.signer as any).type}`);
    }
  }
}
