import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { EvmSchema } from '@/config/config.schema';

type EvmConfig = z.infer<typeof EvmSchema>;
type NetworkConfig = EvmConfig['networks'][number];
type RpcOptions = NetworkConfig['rpc']['options'];
type WsOptions = NonNullable<NetworkConfig['ws']>['options'];
type TokenConfig = NetworkConfig['tokens'][number];
type FeeLogic = NetworkConfig['feeLogic'];

@Injectable()
export class EvmConfigService {
  private _networks: Map<number, NetworkConfig>;

  constructor(private configService: ConfigService) {
    this._networks = new Map();
    this.initializeNetworks();
  }

  private initializeNetworks(): void {
    const networks = this.configService.get<NetworkConfig[]>('evm.networks', []);
    for (const network of networks) {
      this._networks.set(network.chainId, network);
    }
  }

  get privateKey(): EvmConfig['privateKey'] {
    return this.configService.get<string>('evm.privateKey');
  }

  get walletAddress(): EvmConfig['walletAddress'] {
    return this.configService.get<string>('evm.walletAddress');
  }

  get networks(): NetworkConfig[] {
    return Array.from(this._networks.values());
  }

  get supportedChainIds(): number[] {
    return Array.from(this._networks.keys());
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

  getRpcUrls(chainId: number): string[] {
    const network = this.getNetworkOrThrow(chainId);
    return network.rpc.urls;
  }

  getRpcOptions(chainId: number): RpcOptions | undefined {
    const network = this.getNetworkOrThrow(chainId);
    return network.rpc.options;
  }

  getWsUrls(chainId: number): string[] | undefined {
    const network = this.getNetworkOrThrow(chainId);
    return network.ws?.urls;
  }

  getWsOptions(chainId: number): WsOptions | undefined {
    const network = this.getNetworkOrThrow(chainId);
    return network.ws?.options;
  }

  getIntentSourceAddress(chainId: number): string {
    const network = this.getNetworkOrThrow(chainId);
    return network.intentSourceAddress;
  }

  getInboxAddress(chainId: number): string {
    const network = this.getNetworkOrThrow(chainId);
    return network.inboxAddress;
  }

  getSupportedTokens(chainId: number): TokenConfig[] {
    const network = this.getNetworkOrThrow(chainId);
    return network.tokens;
  }

  isTokenSupported(chainId: number, tokenAddress: string): boolean {
    const tokens = this.getSupportedTokens(chainId);
    return tokens.some(
      (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
    );
  }

  getTokenConfig(chainId: number, tokenAddress: string): TokenConfig | undefined {
    const tokens = this.getSupportedTokens(chainId);
    return tokens.find(
      (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
    );
  }

  getFeeLogic(chainId: number): FeeLogic {
    const network = this.getNetworkOrThrow(chainId);
    return network.feeLogic;
  }
}
