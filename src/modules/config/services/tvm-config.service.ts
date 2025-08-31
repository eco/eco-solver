import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  TvmNetworkConfig,
  TvmTokenConfig,
  TvmTransactionSettings,
  TvmWalletsConfig,
} from '@/config/schemas';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { TvmUtilsService } from '@/modules/blockchain/tvm/services/tvm-utils.service';

@Injectable()
export class TvmConfigService {
  constructor(private configService: ConfigService) {
    this._networks = new Map();
    this.initializeNetworks();
  }

  private _networks: Map<number, TvmNetworkConfig>;

  get networks(): TvmNetworkConfig[] {
    return Array.from(this._networks.values());
  }

  get supportedChainIds(): (string | number)[] {
    return Array.from(this._networks.keys());
  }

  get wallets(): TvmWalletsConfig {
    return this.configService.get<TvmWalletsConfig>('tvm.wallets', {});
  }

  getBasicWalletConfig() {
    return this.wallets.basic;
  }

  getChain(chainId: number | string | bigint): TvmNetworkConfig {
    const numChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : Number(chainId);
    const network = this._networks.get(numChainId);
    if (!network) {
      throw new Error(`Network configuration not found for chainId: ${chainId}`);
    }
    return network;
  }

  getRpc(chainId: number | string | bigint) {
    const network = this.getChain(chainId);
    return network.rpc;
  }

  getSupportedTokens(chainId: number | bigint | string): TvmTokenConfig[] {
    const numChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : Number(chainId);
    const network = this.getChain(numChainId);
    return network.tokens;
  }

  isTokenSupported(chainId: number | string | bigint, tokenAddress: string): boolean {
    const tokens = this.getSupportedTokens(chainId);
    // Normalize the input address to Base58 format for comparison
    const normalizedAddress = TvmUtilsService.normalizeAddressToBase58(tokenAddress);
    return tokens.some(
      (token) => TvmUtilsService.normalizeAddressToBase58(token.address) === normalizedAddress,
    );
  }

  getTokenConfig(chainId: bigint | number | string, tokenAddress: string): TvmTokenConfig {
    const tokens = this.getSupportedTokens(chainId);
    // Normalize the input address to Base58 format for comparison
    const normalizedAddress = TvmUtilsService.normalizeAddressToBase58(tokenAddress);
    const tokenConfig = tokens.find(
      (token) => TvmUtilsService.normalizeAddressToBase58(token.address) === normalizedAddress,
    );
    if (!tokenConfig) {
      throw new Error(`Unable to get token ${tokenAddress} config for chainId: ${chainId}`);
    }
    return tokenConfig;
  }

  getFeeLogic(chainId: number | string | bigint): AssetsFeeSchemaType {
    const network = this.getChain(chainId);
    return network.fee;
  }

  private initializeNetworks(): void {
    const networks = this.configService.get<TvmNetworkConfig[]>('tvm.networks', []);
    for (const network of networks) {
      this._networks.set(network.chainId, network);
    }
  }

  isConfigured(): boolean {
    // Check if TVM configuration exists with at least one network
    const tvmConfig = this.configService.get('tvm');
    return !!(tvmConfig && this._networks.size > 0);
  }

  getPortalAddress(chainId: number | string | bigint): string {
    const network = this.getChain(chainId);
    return network.contracts.portal;
  }

  getProverAddress(chainId: number | string | bigint, proverType: 'hyper' | 'metalayer'): string | undefined {
    const network = this.getChain(chainId);
    return network.provers?.[proverType];
  }

  /**
   * Gets transaction settings configuration
   * @returns Transaction settings
   */
  getTransactionSettings(): TvmTransactionSettings {
    return this.configService.get<TvmTransactionSettings>('tvm.transactionSettings', {
      defaultFeeLimit: 150000000,
      maxTransactionAttempts: 30,
      transactionCheckInterval: 2000,
      listenerPollInterval: 3000,
    });
  }
}
