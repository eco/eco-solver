import { Injectable } from '@nestjs/common';

import { Connection, Keypair } from '@solana/web3.js';

import { ISvmWallet } from '@/common/interfaces/svm-wallet.interface';
import { SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';

import { BasicWallet } from './basic-wallet';

/**
 * Factory service for creating BasicWallet instances
 */
@Injectable()
export class BasicWalletFactory {
  private connection: Connection;

  constructor(
    private readonly solanaConfigService: SolanaConfigService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(BasicWalletFactory.name);
    this.connection = new Connection(this.solanaConfigService.rpcUrl, 'confirmed');
  }

  /**
   * Creates a BasicWallet instance
   * @param _chainId - Chain ID (not used for Solana, included for interface compatibility)
   * @returns A BasicWallet instance
   */
  create(_chainId?: number | string): ISvmWallet {
    const secretKey = this.solanaConfigService.secretKey;
    if (!secretKey) {
      throw new Error('Solana secret key not configured');
    }

    try {
      // Parse the secret key - expecting a JSON array format
      const secretKeyArray = JSON.parse(secretKey);
      const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));

      this.logger.log(`Created BasicWallet for address ${keypair.publicKey.toString()}`);
      return new BasicWallet(this.connection, keypair);
    } catch (error) {
      throw new Error(
        `Failed to create BasicWallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
