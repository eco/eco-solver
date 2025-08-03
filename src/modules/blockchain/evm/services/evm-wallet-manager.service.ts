import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { Address } from 'viem';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { EvmConfigService } from '@/modules/config/services';

import { BasicWalletFactory } from '../wallets/basic-wallet';
import { KernelWalletFactory } from '../wallets/kernel-wallet';

type WalletType = 'basic' | 'kernel';

@Injectable()
export class EvmWalletManager implements OnModuleInit {
  private readonly logger = new Logger(EvmWalletManager.name);
  // Map of chainId -> walletType -> wallet
  private wallets: Map<number, Map<WalletType, IEvmWallet>> = new Map();
  private defaultWalletType: WalletType = 'basic';

  constructor(
    private evmConfigService: EvmConfigService,
    private basicWalletFactory: BasicWalletFactory,
    private kernelWalletFactory: KernelWalletFactory,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing EVM wallets from configuration');

    // Initialize wallets for each supported chain
    for (const chainId of this.evmConfigService.supportedChainIds) {
      this.initializeWalletsForChain(chainId);
    }
  }

  private initializeWalletsForChain(chainId: number) {
    if (!this.wallets.has(chainId)) {
      this.wallets.set(chainId, new Map());
    }

    const chainWallets = this.wallets.get(chainId)!;

    // Initialize a basic wallet if configured
    try {
      const wallet = this.basicWalletFactory.createWallet(chainId);
      chainWallets.set('basic', wallet);
      this.logger.debug(`Initialized basic wallet for chain ${chainId}`);
    } catch (error) {
      this.logger.error(`Failed to initialize basic wallet for chain ${chainId}: ${error.message}`);
      throw error;
    }

    try {
      const wallet = this.kernelWalletFactory.createWallet(chainId);
      chainWallets.set('kernel', wallet);
      this.logger.debug(`Initialized kernel wallet for chain ${chainId}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize kernel wallet for chain ${chainId}: ${error.message}`,
      );
      throw error;
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
