import { Injectable } from '@nestjs/common';

import { PublicKey } from '@solana/web3.js';

import { ISvmWallet } from '@/common/interfaces/svm-wallet.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { SystemLoggerService } from '@/modules/logging';

import { BasicWalletFactory } from '../wallets/basic-wallet';

export type SvmWalletType = 'basic'; // Can be extended in the future

/**
 * Service for managing SVM wallets
 */
@Injectable()
export class SvmWalletManagerService {
  constructor(
    private readonly basicWalletFactory: BasicWalletFactory,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(SvmWalletManagerService.name);
  }

  /**
   * Creates a wallet instance for the specified chain and type
   * @param chainId - The chain ID to create wallet for (not used for Solana)
   * @param walletType - The type of wallet to create (default: 'basic')
   * @returns A wallet instance
   * @throws Error if wallet type is not supported
   */
  createWallet(chainId?: number | string, walletType: SvmWalletType = 'basic'): ISvmWallet {
    this.logger.log(`Creating SVM wallet of type ${walletType}`);

    switch (walletType) {
      case 'basic':
        return this.basicWalletFactory.create(chainId);
      default:
        throw new Error(`Unsupported SVM wallet type: ${walletType}`);
    }
  }

  /**
   * Gets the address for a specific wallet type
   * @param chainId - The chain ID (not used for Solana)
   * @param walletType - The type of wallet (default: 'basic')
   * @returns The wallet address as a UniversalAddress
   */
  async getWalletAddress(
    chainId?: number | string,
    walletType: SvmWalletType = 'basic',
  ): Promise<UniversalAddress> {
    const wallet = this.createWallet(chainId, walletType);
    const publicKey = await wallet.getAddress();
    return AddressNormalizer.normalizeSvm(publicKey.toString());
  }

  /**
   * Gets the public key for a specific wallet type
   * @param chainId - The chain ID (not used for Solana)
   * @param walletType - The type of wallet (default: 'basic')
   * @returns The wallet's PublicKey
   */
  async getWalletPublicKey(
    chainId?: number | string,
    walletType: SvmWalletType = 'basic',
  ): Promise<PublicKey> {
    const wallet = this.createWallet(chainId, walletType);
    return wallet.getAddress();
  }
}
