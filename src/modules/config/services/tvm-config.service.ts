import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  TvmFeeLogicConfig,
  TvmNetworkConfig,
  TvmTokenConfig,
  TvmTransactionSettings,
  TvmWalletsConfig,
} from '@/config/schemas';

@Injectable()
export class TvmConfigService {
  constructor(private configService: ConfigService) {
    this._networks = new Map();
    this.initializeNetworks();
  }

  private _networks: Map<string | number, TvmNetworkConfig>;

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

  getChain(chainId: number | string): TvmNetworkConfig {
    const network = this._networks.get(chainId);
    if (!network) {
      throw new Error(`Network configuration not found for chainId: ${chainId}`);
    }
    return network;
  }

  getRpc(chainId: number | string) {
    const network = this.getChain(chainId);
    return network.rpc;
  }

  getSupportedTokens(chainId: number | bigint | string): TvmTokenConfig[] {
    const network = this.getChain(
      typeof chainId === 'bigint' ? chainId.toString() : chainId,
    );
    return network.tokens;
  }

  isTokenSupported(chainId: number | string, tokenAddress: string): boolean {
    const tokens = this.getSupportedTokens(chainId);
    return tokens.some((token) => token.address === tokenAddress);
  }

  getTokenConfig(chainId: bigint | number | string, tokenAddress: string): TvmTokenConfig {
    const tokens = this.getSupportedTokens(chainId);
    const tokenConfig = tokens.find((token) => token.address === tokenAddress);
    if (!tokenConfig) {
      throw new Error(`Unable to get token ${tokenAddress} config for chainId: ${chainId}`);
    }
    return tokenConfig;
  }

  getFeeLogic(chainId: number | string): TvmFeeLogicConfig {
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

  getIntentSourceAddress(chainId: number | string): string {
    const network = this.getChain(chainId);
    return network.intentSourceAddress;
  }

  getInboxAddress(chainId: number | string): string {
    const network = this.getChain(chainId);
    return network.inboxAddress;
  }

  getProverAddress(
    chainId: number | string,
    proverType: 'hyper' | 'metalayer',
  ): string | undefined {
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