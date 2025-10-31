import { Injectable, OnModuleInit } from '@nestjs/common';

import { ISvmWallet } from '@/common/interfaces/svm-wallet.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getErrorMessage } from '@/common/utils/error-handler';
import { SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';

import { BasicWalletFactory } from '../wallets/basic-wallet';
import { VaultWalletFactory } from '../wallets/vault-wallet';

export type SvmWalletType = 'basic'; // Can be extended in the future

/**
 * Service for managing SVM wallets
 */
@Injectable()
export class SvmWalletManagerService implements OnModuleInit {
  // Map of chainId -> walletType -> wallet
  private wallets: Map<number, Map<SvmWalletType, ISvmWallet>> = new Map();

  constructor(
    private readonly basicWalletFactory: BasicWalletFactory,
    private readonly vaultWalletFactory: VaultWalletFactory,
    private readonly solanaConfigService: SolanaConfigService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(SvmWalletManagerService.name);
  }

  async onModuleInit() {
    this.logger.log('Initializing SVM wallets from configuration');

    // Initialize wallets for the configured Solana chain
    if (this.solanaConfigService.isConfigured()) {
      await this.initializeWalletsForChain(this.solanaConfigService.chainId);
    }
  }

  /**
   * Creates a wallet instance for the specified chain and type
   * @param chainId - The chain ID to create wallet for (not used for Solana)
   * @param walletType - The type of wallet to create (default: 'basic')
   * @returns A wallet instance
   * @throws Error if wallet type is not supported
   * @deprecated Use getWallet() instead for cached wallet instances
   */
  createWallet(chainId?: number, walletType: SvmWalletType = 'basic'): ISvmWallet {
    // Use the configured chain ID if not provided
    const effectiveChainId = chainId ? Number(chainId) : this.solanaConfigService.chainId;
    return this.getWallet(walletType, effectiveChainId);
  }

  /**
   * Gets a cached wallet instance for the specified type and chain
   * @param walletType - The type of wallet to get (default: 'basic')
   * @param chainId - The chain ID (defaults to configured Solana chain)
   * @returns A cached wallet instance
   * @throws Error if wallet is not found or not initialized
   */
  getWallet(walletType: SvmWalletType = 'basic', chainId?: number): ISvmWallet {
    const effectiveChainId = chainId ?? this.solanaConfigService.chainId;
    const chainWallets = this.wallets.get(effectiveChainId);

    if (!chainWallets) {
      throw new Error(`No wallets configured for chain ${effectiveChainId}`);
    }

    const wallet = chainWallets.get(walletType);
    if (!wallet) {
      throw new Error(`Wallet type '${walletType}' not found for chain ${effectiveChainId}`);
    }

    return wallet;
  }

  /**
   * Gets the address for a specific wallet type
   * @param chainId - The chain ID (not used for Solana)
   * @param walletType - The type of wallet (default: 'basic')
   * @returns The wallet address as a UniversalAddress
   */
  async getWalletAddress(
    chainId?: number,
    walletType: SvmWalletType = 'basic',
  ): Promise<UniversalAddress> {
    const wallet = this.getWallet(walletType, chainId);
    const publicKey = await wallet.getAddress();
    return AddressNormalizer.normalizeSvm(publicKey);
  }

  private async initializeWalletsForChain(chainId: number) {
    if (!this.wallets.has(chainId)) {
      this.wallets.set(chainId, new Map());
    }

    const chainWallets = this.wallets.get(chainId)!;
    const walletConfig = this.solanaConfigService.wallets.basic;

    try {
      // Select wallet implementation based on configuration type
      let wallet: ISvmWallet;

      if (walletConfig.type === 'basic') {
        this.logger.log(`Initializing BasicWallet with private key for chain ${chainId}`);
        wallet = this.basicWalletFactory.create(chainId);
      } else if (walletConfig.type === 'vault') {
        this.logger.log(
          `Initializing VaultWallet with HashiCorp Vault (${walletConfig.endpoint}) for chain ${chainId}`,
        );
        wallet = await this.vaultWalletFactory.create(chainId);
      } else {
        throw new Error(`Unsupported wallet type: ${(walletConfig as any).type}`);
      }

      // Cache the wallet under 'basic' key
      chainWallets.set('basic', wallet);
      this.logger.log(
        `Initialized ${walletConfig.type} wallet for chain ${chainId}: ${(await wallet.getAddress()).toString()}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize wallet for chain ${chainId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
