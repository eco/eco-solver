import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { Address } from 'viem';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { IWalletFactory } from '@/modules/blockchain/evm/interfaces/wallet-factory.interface';
import { EvmConfigService } from '@/modules/config/services';

import { BasicWalletFactory } from '../wallets/basic-wallet';
import { KernelWalletFactory } from '../wallets/kernel-wallet';

export type WalletType = 'basic' | 'kernel';

@Injectable()
export class EvmWalletManager implements OnModuleInit {
  private readonly logger = new Logger(EvmWalletManager.name);
  // Map of chainId -> walletType -> wallet
  private wallets: Map<number, Map<WalletType, IEvmWallet>> = new Map();
  private defaultWalletType: WalletType = 'basic';
  private readonly walletFactories: IWalletFactory[];

  constructor(
    private evmConfigService: EvmConfigService,
    private basicWalletFactory: BasicWalletFactory,
    private kernelWalletFactory: KernelWalletFactory,
  ) {
    this.walletFactories = [this.basicWalletFactory, this.kernelWalletFactory];
  }

  async onModuleInit() {
    this.logger.log('Initializing EVM wallets from configuration');

    // Initialize wallets for each supported chain
    const initRequests = this.evmConfigService.supportedChainIds.map((chainId) =>
      this.initializeWalletsForChain(chainId),
    );

    await Promise.all(initRequests);
  }

  private async initializeWalletsForChain(chainId: number) {
    if (!this.wallets.has(chainId)) {
      this.wallets.set(chainId, new Map());
    }

    const chainWallets = this.wallets.get(chainId)!;

    for (const walletFactory of this.walletFactories) {
      try {
        const wallet = await walletFactory.createWallet(chainId);
        chainWallets.set(walletFactory.name, wallet);
        this.logger.debug(`Initialized ${walletFactory.name} wallet for chain ${chainId}`);
      } catch (error) {
        this.logger.error(
          `Failed to initialize ${walletFactory.name} for chain ${chainId}: ${error.message}`,
        );
        throw error;
      }
    }
  }

  getWallet(walletType: WalletType | undefined, chainId: number): IEvmWallet {
    const type = walletType || this.defaultWalletType;

    const chainWallets = this.wallets.get(chainId);
    if (!chainWallets) {
      throw new Error(`No wallets configured for chain ${chainId}`);
    }

    const wallet = chainWallets.get(type);
    if (!wallet) {
      throw new Error(`Wallet type '${type}' not found for chain ${chainId}`);
    }

    return wallet;
  }

  async getWalletAddress(walletType: WalletType, chainId: number): Promise<Address> {
    const wallet = this.getWallet(walletType, chainId);
    return wallet.getAddress();
  }
}
