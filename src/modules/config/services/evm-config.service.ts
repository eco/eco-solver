import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Address } from 'viem';

import {
  EvmFeeLogicConfig,
  EvmNetworkConfig,
  EvmTokenConfig,
  EvmWalletsConfig,
} from '@/config/schemas';

@Injectable()
export class EvmConfigService {
  constructor(private configService: ConfigService) {
    this._networks = new Map();
    this.initializeNetworks();
  }

  private _networks: Map<number, EvmNetworkConfig>;

  get networks(): EvmNetworkConfig[] {
    return Array.from(this._networks.values());
  }

  get supportedChainIds(): number[] {
    return Array.from(this._networks.keys());
  }

  get wallets(): EvmWalletsConfig {
    return this.configService.get<EvmWalletsConfig>('evm.wallets', {});
  }

  getBasicWalletConfig() {
    return this.wallets.basic;
  }

  getKernelWalletConfig() {
    return this.wallets.kernel;
  }

  getChain(chainId: number): EvmNetworkConfig {
    const network = this._networks.get(chainId);
    if (!network) {
      throw new Error(`Network configuration not found for chainId: ${chainId}`);
    }
    return network;
  }

  getRpc(chainId: number) {
    const network = this.getChain(chainId);
    return network.rpc;
  }

  getSupportedTokens(chainId: number | bigint): EvmTokenConfig[] {
    const network = this.getChain(Number(chainId));
    return network.tokens;
  }

  isTokenSupported(chainId: number, tokenAddress: string): boolean {
    const tokens = this.getSupportedTokens(chainId);
    return tokens.some((token) => token.address.toLowerCase() === tokenAddress.toLowerCase());
  }

  getTokenConfig(chainId: bigint | number, tokenAddress: string): EvmTokenConfig {
    const tokens = this.getSupportedTokens(chainId);
    const tokenConfig = tokens.find(
      (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
    );
    if (!tokenConfig) {
      throw new Error(`Unable to get token ${tokenAddress} config for chainId: ${chainId}`);
    }
    return tokenConfig;
  }

  getFeeLogic(chainId: number): EvmFeeLogicConfig {
    const network = this.getChain(chainId);
    return network.fee;
  }

  private initializeNetworks(): void {
    const networks = this.configService.get<EvmNetworkConfig[]>('evm.networks', []);
    for (const network of networks) {
      this._networks.set(network.chainId, network);
    }
  }

  isConfigured(): boolean {
    // Check if EVM configuration exists with at least one network
    const evmConfig = this.configService.get('evm');
    return !!(evmConfig && this._networks.size > 0);
  }

  getIntentSourceAddress(chainId: number): Address {
    const network = this.getChain(chainId);
    return network.intentSourceAddress as Address;
  }

  getInboxAddress(chainId: number): Address {
    const network = this.getChain(chainId);
    return network.inboxAddress as Address;
  }

  getProverAddress(chainId: number, proverType: 'hyper' | 'metalayer'): Address | undefined {
    const network = this.getChain(chainId);
    return network.provers?.[proverType] as Address | undefined;
  }
}
