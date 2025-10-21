import { Injectable } from '@nestjs/common';

import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

import { ISvmWallet } from '@/common/interfaces/svm-wallet.interface';
import { SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

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
    private readonly otelService: OpenTelemetryService,
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
    const walletConfig = this.solanaConfigService.wallets.basic;

    if (walletConfig.type !== 'basic') {
      throw new Error(
        'BasicWalletFactory requires basic wallet configuration, got: ' + walletConfig.type,
      );
    }

    const secretKey = walletConfig.secretKey;
    if (!secretKey) {
      throw new Error('Solana secret key not configured for basic wallet');
    }

    try {
      // Parse the secret key
      const secretKeyArray = bs58.decode(secretKey);
      const keypair = Keypair.fromSecretKey(secretKeyArray);

      this.logger.log(`Created BasicWallet for address ${keypair.publicKey.toString()}`);
      return new BasicWallet(this.connection, keypair, this.otelService);
    } catch (error) {
      throw new Error(
        `Failed to create BasicWallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
