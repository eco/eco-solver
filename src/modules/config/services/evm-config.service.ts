import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { EvmSchema } from '@/config/config.schema';

type EvmConfig = z.infer<typeof EvmSchema>;
type NetworkConfig = EvmConfig['networks'][number];
type TokenConfig = NetworkConfig['tokens'][number];
type FeeLogic = NetworkConfig['feeLogic'];

@Injectable()
export class EvmConfigService {
  constructor(private configService: ConfigService) {
    this._networks = new Map();
    this.initializeNetworks();
  }

  private _networks: Map<number, NetworkConfig>;

  get networks(): NetworkConfig[] {
    return Array.from(this._networks.values());
  }

  get supportedChainIds(): number[] {
    return Array.from(this._networks.keys());
  }

  get privateKey(): string {
    return this.configService.get<string>('evm.privateKey')!;
  }

  getNetwork(chainId: number): NetworkConfig | undefined {
    return this._networks.get(chainId);
  }

  getNetworkOrThrow(chainId: number): NetworkConfig {
    const network = this.getNetwork(chainId);
    if (!network) {
      throw new Error(`Network configuration not found for chainId: ${chainId}`);
    }
    return network;
  }

  getRpc(chainId: number) {
    const network = this.getNetworkOrThrow(chainId);
    return network.rpc;
  }

  getSupportedTokens(chainId: number): TokenConfig[] {
    const network = this.getNetworkOrThrow(chainId);
    return network.tokens;
  }

  isTokenSupported(chainId: number, tokenAddress: string): boolean {
    const tokens = this.getSupportedTokens(chainId);
    return tokens.some((token) => token.address.toLowerCase() === tokenAddress.toLowerCase());
  }

  getTokenConfig(chainId: number, tokenAddress: string): TokenConfig | undefined {
    const tokens = this.getSupportedTokens(chainId);
    return tokens.find((token) => token.address.toLowerCase() === tokenAddress.toLowerCase());
  }

  getFeeLogic(chainId: number): FeeLogic {
    const network = this.getNetworkOrThrow(chainId);
    return network.feeLogic;
  }

  private initializeNetworks(): void {
    const networks = this.configService.get<NetworkConfig[]>('evm.networks', []);
    for (const network of networks) {
      this._networks.set(network.chainId, network);
    }
  }
}
