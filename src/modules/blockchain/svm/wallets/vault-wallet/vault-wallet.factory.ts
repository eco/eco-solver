import { Injectable } from '@nestjs/common';

import { Connection } from '@solana/web3.js';

import { ISvmWallet } from '@/common/interfaces/svm-wallet.interface';
import { SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { VaultClient } from './vault-client';
import { VaultWallet } from './vault-wallet';

/**
 * Factory service for creating VaultWallet instances
 */
@Injectable()
export class VaultWalletFactory {
  private connection: Connection;
  private vaultClient: VaultClient | null = null;

  constructor(
    private readonly solanaConfigService: SolanaConfigService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    this.logger.setContext(VaultWalletFactory.name);
    this.connection = new Connection(this.solanaConfigService.rpcUrl, 'confirmed');
  }

  /**
   * Creates a VaultWallet instance
   * @param _chainId - Chain ID (not used for Solana, included for interface compatibility)
   * @returns A VaultWallet instance
   */
  async create(_chainId?: number | string): Promise<ISvmWallet> {
    const walletConfig = this.solanaConfigService.wallets.basic;

    if (walletConfig.type !== 'vault') {
      throw new Error(
        'VaultWalletFactory requires vault wallet configuration, got: ' + walletConfig.type,
      );
    }

    try {
      // Initialize Vault client if not already done
      if (!this.vaultClient) {
        this.logger.log('Initializing HashiCorp Vault client');

        this.vaultClient = new VaultClient(
          walletConfig.endpoint,
          walletConfig.transitPath,
          walletConfig.keyName,
          walletConfig.auth,
          this.logger,
        );

        // Authenticate with Vault
        this.logger.log(`Authenticating with Vault using ${walletConfig.auth.type} auth`);
        await this.vaultClient.authenticate();
        this.logger.log('Successfully authenticated with Vault');
      }

      // Get public key from Vault
      this.logger.log(`Fetching public key for signing key: ${walletConfig.keyName}`);
      const publicKey = await this.vaultClient.getPublicKey();
      this.logger.log(`VaultWallet created for address: ${publicKey.toString()}`);

      return new VaultWallet(this.connection, this.vaultClient, publicKey, this.otelService);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during VaultWallet creation';
      this.logger.error(`Failed to create VaultWallet: ${errorMessage}`);
      throw new Error(`Failed to create VaultWallet: ${errorMessage}`);
    }
  }
}
