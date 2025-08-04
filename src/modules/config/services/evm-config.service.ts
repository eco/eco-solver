import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  get privateKey(): string {
    return this.configService.get<string>('evm.privateKey')!;
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

  getSupportedTokens(chainId: number): EvmTokenConfig[] {
    const network = this.getChain(chainId);
    return network.tokens;
  }

  isTokenSupported(chainId: number, tokenAddress: string): boolean {
    const tokens = this.getSupportedTokens(chainId);
    return tokens.some((token) => token.address.toLowerCase() === tokenAddress.toLowerCase());
  }

  getTokenConfig(chainId: number, tokenAddress: string): EvmTokenConfig | undefined {
    const tokens = this.getSupportedTokens(chainId);
    return tokens.find((token) => token.address.toLowerCase() === tokenAddress.toLowerCase());
  }

  getFeeLogic(chainId: number): EvmFeeLogicConfig {
    const network = this.getChain(chainId);
    return network.feeLogic;
  }

  private initializeNetworks(): void {
    const networks = this.configService.get<EvmNetworkConfig[]>('evm.networks', []);
    for (const network of networks) {
      this._networks.set(network.chainId, network);
    }
  }
}
