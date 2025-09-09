import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import {
  TvmNetworkConfig,
  TvmTokenConfig,
  TvmTransactionSettings,
  TvmWalletsConfig,
} from '@/config/schemas';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { TronAddress } from '@/modules/blockchain/tvm/types';
import { ChainIdentifier } from '@/modules/token/types/token.types';

import { IBlockchainConfigService } from '../interfaces/blockchain-config.interface';

@Injectable()
export class TvmConfigService implements IBlockchainConfigService {
  constructor(private configService: ConfigService) {
    this._networks = new Map();
    this.initializeNetworks();
  }

  private _networks: Map<number, TvmNetworkConfig>;

  get networks(): TvmNetworkConfig[] {
    return Array.from(this._networks.values());
  }

  get supportedChainIds(): number[] {
    return Array.from(this._networks.keys());
  }

  getSupportedChainIds(): number[] {
    return this.supportedChainIds;
  }

  get wallets(): TvmWalletsConfig {
    return this.configService.get<TvmWalletsConfig>('tvm.wallets')!;
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

  getSupportedTokens(chainId: ChainIdentifier): Array<{
    address: UniversalAddress;
    decimals: number;
    limit?: number | { min?: number; max?: number };
  }> {
    const numChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : Number(chainId);
    const network = this.getChain(numChainId);
    return network.tokens.map((token) => ({
      address: AddressNormalizer.normalizeTvm(token.address),
      decimals: token.decimals,
      limit: token.limit,
    }));
  }

  // Legacy method for backward compatibility
  getTvmSupportedTokens(chainId: number | bigint | string): TvmTokenConfig[] {
    const numChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : Number(chainId);
    const network = this.getChain(numChainId);
    return network.tokens;
  }

  isTokenSupported(chainId: ChainIdentifier, tokenAddress: UniversalAddress): boolean {
    const tokens = this.getTvmSupportedTokens(chainId);
    // Normalize the input address to Base58 format for comparison
    const normalizedAddress = AddressNormalizer.denormalizeToTvm(tokenAddress);
    return tokens.some((token) => token.address === normalizedAddress);
  }

  getTokenConfig(
    chainId: ChainIdentifier,
    tokenAddress: UniversalAddress,
  ): {
    address: UniversalAddress;
    decimals: number;
    limit?: number | { min?: number; max?: number };
  } {
    const tokens = this.getTvmSupportedTokens(chainId);
    const denormalizedAddress = AddressNormalizer.denormalizeToTvm(tokenAddress);
    const tokenConfig = tokens.find((token) => token.address === denormalizedAddress);
    if (!tokenConfig) {
      throw new Error(`Unable to get token ${tokenAddress} config for chainId: ${chainId}`);
    }
    return {
      address: AddressNormalizer.normalizeTvm(tokenConfig.address),
      decimals: tokenConfig.decimals,
      limit: tokenConfig.limit,
    };
  }

  // Legacy method for backward compatibility
  getTvmTokenConfig(
    chainId: bigint | number | string,
    tokenAddress: UniversalAddress,
  ): TvmTokenConfig {
    const tokens = this.getTvmSupportedTokens(chainId);
    const denormalizedAddress = AddressNormalizer.denormalizeToTvm(tokenAddress);
    const tokenConfig = tokens.find((token) => token.address === denormalizedAddress);
    if (!tokenConfig) {
      throw new Error(`Unable to get token ${tokenAddress} config for chainId: ${chainId}`);
    }
    return tokenConfig;
  }

  getFeeLogic(chainId: ChainIdentifier): AssetsFeeSchemaType {
    const network = this.getChain(chainId);
    return network.fee;
  }

  isConfigured(): boolean {
    // Check if TVM configuration exists with at least one network
    const tvmConfig = this.configService.get('tvm');
    return !!(tvmConfig && this._networks.size > 0);
  }

  getPortalAddress(chainId: ChainIdentifier): UniversalAddress {
    const network = this.getChain(chainId);
    return AddressNormalizer.normalizeTvm(network.contracts.portal as TronAddress);
  }

  // Legacy method for backward compatibility
  getTvmPortalAddress(chainId: number | string | bigint): TronAddress {
    const network = this.getChain(chainId);
    return network.contracts.portal as TronAddress;
  }

  getProverAddress(
    chainId: ChainIdentifier,
    proverType: TProverType,
  ): UniversalAddress | undefined {
    const network = this.getChain(chainId);
    const address = network.provers?.[proverType] as TronAddress | undefined;
    return address ? AddressNormalizer.normalizeTvm(address) : undefined;
  }

  // Legacy method for backward compatibility
  getTvmProverAddress(
    chainId: number | string | bigint,
    proverType: TProverType,
  ): TronAddress | undefined {
    const network = this.getChain(chainId);
    return network.provers?.[proverType] as TronAddress;
  }

  /**
   * Gets transaction settings configuration
   * @returns Transaction settings
   */
  getTransactionSettings(): TvmTransactionSettings {
    return this.configService.get<TvmTransactionSettings>('tvm.transactionSettings')!;
  }

  getClaimant(chainId: ChainIdentifier): UniversalAddress {
    const network = this.getChain(chainId);
    return AddressNormalizer.normalizeTvm(network.claimant);
  }

  /**
   * Gets the default prover type for the chain
   * @param chainId Chain identifier
   * @returns Default prover type
   */
  getDefaultProver(chainId: ChainIdentifier): TProverType {
    const network = this.getChain(chainId);
    return network.defaultProver;
  }

  private initializeNetworks(): void {
    const networks = this.configService.get<TvmNetworkConfig[]>('tvm.networks', []);
    for (const network of networks) {
      this._networks.set(network.chainId, network);
    }
  }
}
