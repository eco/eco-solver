import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Address, isAddressEqual } from 'viem';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { EvmNetworkConfig, EvmTokenConfig, EvmWalletsConfig } from '@/config/schemas';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';

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

  getSupportedTokens(chainId: number | bigint): EvmTokenConfig[] {
    const network = this.getChain(Number(chainId));
    return network.tokens;
  }

  isTokenSupported(chainId: number, tokenAddress: UniversalAddress): boolean {
    const tokens = this.getSupportedTokens(chainId);
    const normalizedAddress = AddressNormalizer.denormalizeToEvm(tokenAddress);
    return tokens.some((token) => isAddressEqual(token.address, normalizedAddress));
  }

  getTokenConfig(chainId: bigint | number, tokenAddress: UniversalAddress): EvmTokenConfig {
    const tokens = this.getSupportedTokens(chainId);
    const tokenConfig = tokens.find(
      (token) => AddressNormalizer.normalizeEvm(token.address) === tokenAddress,
    );
    if (!tokenConfig) {
      throw new Error(`Unable to get token ${tokenAddress} config for chainId: ${chainId}`);
    }
    return tokenConfig;
  }

  getFeeLogic(chainId: number): AssetsFeeSchemaType {
    const network = this.getChain(chainId);
    return network.fee;
  }

  isConfigured(): boolean {
    // Check if EVM configuration exists with at least one network
    const evmConfig = this.configService.get('evm');
    return !!(evmConfig && this._networks.size > 0);
  }

  getPortalAddress(chainId: number): Address {
    const network = this.getChain(chainId);
    return network.contracts.portal as Address;
  }

  getProverAddress(chainId: number, proverType: 'hyper' | 'metalayer'): Address | undefined {
    const network = this.getChain(chainId);
    return network.provers?.[proverType] as Address | undefined;
  }

  private initializeNetworks(): void {
    const networks = this.configService.get<EvmNetworkConfig[]>('evm.networks', []);
    for (const network of networks) {
      this._networks.set(network.chainId, network);
    }
  }
}
