import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { Hex, LocalAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { KernelWalletConfig } from '@/config/schemas';
import { IWalletFactory } from '@/modules/blockchain/evm/interfaces/wallet-factory.interface';
import { KernelWallet } from '@/modules/blockchain/evm/wallets';
import { kmsToAccount } from '@/modules/blockchain/evm/wallets/kernel-wallet/kms/kms-account';
import { EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmTransportService } from '../../services/evm-transport.service';
import { EvmWalletManager } from '../../services/evm-wallet-manager.service';

@Injectable()
export class KernelWalletFactory implements IWalletFactory {
  readonly name = 'kernel';
  private signerPromise: Promise<LocalAccount> | null = null;
  private kernelWalletConfig: KernelWalletConfig;

  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    private logger: SystemLoggerService,
    private otelService: OpenTelemetryService,
    @Inject(forwardRef(() => EvmWalletManager))
    private evmWalletManager: EvmWalletManager,
  ) {
    this.logger.setContext(KernelWalletFactory.name);

    const kernelWalletConfig = this.evmConfigService.getKernelWalletConfig();
    if (!kernelWalletConfig) {
      throw new Error('Kernel config required');
    }

    this.kernelWalletConfig = kernelWalletConfig;
  }

  async createWallet(chainId: number): Promise<IEvmWallet> {
    // Lazy initialization with promise caching to prevent race conditions
    if (!this.signerPromise) {
      this.signerPromise = this.getWallet();
    }

    const signer = await this.signerPromise;

    const kernelWallet = new KernelWallet(
      chainId,
      signer,
      this.kernelWalletConfig,
      this.evmConfigService.getChain(chainId),
      this.transportService,
      this.logger,
      this.otelService,
      this.evmWalletManager,
    );

    await kernelWallet.init();

    return kernelWallet;
  }

  private getWallet(): Promise<LocalAccount> {
    switch (this.kernelWalletConfig.signer.type) {
      case 'eoa':
        return Promise.resolve(
          privateKeyToAccount(this.kernelWalletConfig.signer.privateKey as Hex),
        );
      case 'kms':
        return kmsToAccount(this.kernelWalletConfig.signer);
      default:
        throw new Error(`Unsupported signer type: ${(this.kernelWalletConfig.signer as any).type}`);
    }
  }
}
