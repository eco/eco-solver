import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Address, isAddressEqual } from 'viem';

import { TProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { EvmNetworkConfig, EvmTokenConfig, EvmWalletsConfig } from '@/config/schemas';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { ChainIdentifier } from '@/modules/token/types/token.types';

import { IBlockchainConfigService } from '../interfaces/blockchain-config.interface';

@Injectable()
export class EvmConfigService implements IBlockchainConfigService {
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

  getSupportedChainIds(): (number | string)[] {
    return this.supportedChainIds;
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

  getSupportedTokens(chainId: ChainIdentifier): Array<{
    address: UniversalAddress;
    decimals: number;
    limit?: number | { min?: number; max?: number };
  }> {
    return this.getEvmSupportedTokens(chainId).map((token) => ({
      address: AddressNormalizer.normalizeEvm(token.address),
      decimals: token.decimals,
      limit: token.limit,
    }));
  }

  // Legacy method for backward compatibility
  getEvmSupportedTokens(chainId: ChainIdentifier): EvmTokenConfig[] {
    const network = this.getChain(Number(chainId));
    return network.tokens;
  }

  isTokenSupported(chainId: ChainIdentifier, tokenAddress: UniversalAddress): boolean {
    const tokens = this.getEvmSupportedTokens(Number(chainId));
    const normalizedAddress = AddressNormalizer.denormalizeToEvm(tokenAddress);
    return tokens.some((token) => isAddressEqual(token.address, normalizedAddress));
  }

  getTokenConfig(
    chainId: ChainIdentifier,
    tokenAddress: UniversalAddress,
  ): {
    address: UniversalAddress;
    decimals: number;
    limit?: number | { min?: number; max?: number };
  } {
    const tokenConfig = this.getEvmTokenConfig(chainId, tokenAddress);
    return {
      address: AddressNormalizer.normalizeEvm(tokenConfig.address),
      decimals: tokenConfig.decimals,
      limit: tokenConfig.limit,
    };
  }

  // Legacy method for backward compatibility
  getEvmTokenConfig(chainId: ChainIdentifier, tokenAddress: UniversalAddress): EvmTokenConfig {
    const tokens = this.getEvmSupportedTokens(Number(chainId));
    const tokenConfig = tokens.find(
      (token) => AddressNormalizer.normalizeEvm(token.address) === tokenAddress,
    );
    if (!tokenConfig) {
      throw new Error(`Unable to get token ${tokenAddress} config for chainId: ${chainId}`);
    }
    return tokenConfig;
  }

  getFeeLogic(chainId: ChainIdentifier): AssetsFeeSchemaType {
    const network = this.getChain(Number(chainId));
    return network.fee;
  }

  isConfigured(): boolean {
    // Check if EVM configuration exists with at least one network
    const evmConfig = this.configService.get('evm');
    return !!(evmConfig && this._networks.size > 0);
  }

  getPortalAddress(chainId: ChainIdentifier): UniversalAddress {
    const network = this.getChain(Number(chainId));
    return AddressNormalizer.normalizeEvm(network.contracts.portal);
  }

  // Legacy method for backward compatibility
  getEvmPortalAddress(chainId: number): Address {
    const network = this.getChain(chainId);
    return network.contracts.portal;
  }

  getProverAddress(
    chainId: ChainIdentifier,
    proverType: TProverType,
  ): UniversalAddress | undefined {
    const address = this.getEvmProverAddress(chainId, proverType);
    return address ? AddressNormalizer.normalizeEvm(address) : undefined;
  }

  // Legacy method for backward compatibility
  getEvmProverAddress(chainId: ChainIdentifier, proverType: TProverType): Address | undefined {
    const network = this.getChain(Number(chainId));
    return network.provers?.[proverType];
  }

  getClaimant(chainId: ChainIdentifier): UniversalAddress {
    const network = this.getChain(Number(chainId));
    return AddressNormalizer.normalizeEvm(network.claimant);
  }

  private initializeNetworks(): void {
    const networks = this.configService.get<EvmNetworkConfig[]>('evm.networks', []);
    for (const network of networks) {
      this._networks.set(network.chainId, network);
    }
  }
}
