import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Hex, LocalAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { KernelWalletConfig } from '@/config/schemas';
import { IWalletFactory } from '@/modules/blockchain/evm/interfaces/wallet-factory.interface';
import { KernelWallet } from '@/modules/blockchain/evm/wallets/kernel-wallet/kernel-wallet';
import { kmsToAccount } from '@/modules/blockchain/evm/wallets/kernel-wallet/kms/kms-account';
import { EvmConfigService } from '@/modules/config/services';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmTransportService } from '../../services/evm-transport.service';
import { EvmWalletManager } from '../../services/evm-wallet-manager.service';

@Injectable()
export class KernelWalletFactory implements IWalletFactory {
  readonly name = 'kernel';
  private signerPromise: Promise<LocalAccount> | null = null;
  private kernelWalletConfig: KernelWalletConfig;

  constructor(
    @InjectPinoLogger(KernelWalletFactory.name)
    private readonly logger: PinoLogger,
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    private otelService: OpenTelemetryService,
    @Inject(forwardRef(() => EvmWalletManager))
    private evmWalletManager: EvmWalletManager,
  ) {
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
      this.logger,
      chainId,
      signer,
      this.kernelWalletConfig,
      this.evmConfigService.getChain(chainId),
      this.transportService,
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
