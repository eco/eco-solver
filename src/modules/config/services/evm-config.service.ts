import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Address, isAddressEqual } from 'viem';
import { z } from 'zod';

import { TProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import {
  EvmNetworkConfig,
  EvmRpcSchema,
  EvmTokenConfig,
  EvmWalletsConfig,
  EvmWsSchema,
  OwnableExecutorConfig,
} from '@/config/schemas';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { ChainIdentifier } from '@/modules/token/types/token.types';

import { IBlockchainConfigService, TokenConfig } from '../interfaces/blockchain-config.interface';

import { FulfillmentConfigService } from './fulfillment-config.service';

@Injectable()
export class EvmConfigService implements IBlockchainConfigService {
  constructor(
    private configService: ConfigService,
    private fulfillmentConfigService: FulfillmentConfigService,
  ) {
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
    return this.configService.get<EvmWalletsConfig>('evm.wallets')!;
  }

  get defaultWallet() {
    // TODO: Move to EvmNetworkConfig
    return 'basic';
  }

  get listenersEnabled(): boolean {
    return this.configService.get<boolean>('evm.listenersEnabled') ?? true;
  }

  getSupportedChainIds(): number[] {
    return this.supportedChainIds;
  }

  getBasicWalletConfig() {
    return this.wallets.basic;
  }

  getKernelWalletConfig() {
    return this.wallets.kernel;
  }

  getOwnableExecutorConfig(): OwnableExecutorConfig | undefined {
    return this.wallets.kernel?.ownableExecutor;
  }

  getChain(chainId: number): EvmNetworkConfig {
    const network = this._networks.get(chainId);
    if (!network) {
      throw new Error(`Network configuration not found for chainId: ${chainId}`);
    }
    return network;
  }

  getSupportedTokens(chainId: ChainIdentifier): TokenConfig[] {
    return this.getEvmSupportedTokens(chainId).map((token) => {
      // Apply global default limit if token doesn't have a specific limit
      const limit = token.limit ?? this.fulfillmentConfigService.defaultRouteLimit;
      return {
        address: AddressNormalizer.normalizeEvm(token.address),
        decimals: token.decimals,
        symbol: token.symbol,
        limit: limit,
        fee: token.fee,
        nonSwapGroups: token.nonSwapGroups,
      };
    });
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

  getTokenConfig(chainId: ChainIdentifier, tokenAddress: UniversalAddress): TokenConfig {
    const tokenConfig = this.getEvmTokenConfig(chainId, tokenAddress);
    // Apply global default limit if token doesn't have a specific limit
    const limit = tokenConfig.limit ?? this.fulfillmentConfigService.defaultRouteLimit;
    return {
      address: AddressNormalizer.normalizeEvm(tokenConfig.address),
      decimals: tokenConfig.decimals,
      symbol: tokenConfig.symbol,
      limit: limit,
      fee: tokenConfig.fee,
      nonSwapGroups: tokenConfig.nonSwapGroups,
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

  getFeeLogic(chainId: ChainIdentifier): AssetsFeeSchemaType | undefined {
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

  /**
   * Gets the default prover type for the chain
   * @param chainId Chain identifier
   * @returns Default prover type
   */
  getDefaultProver(chainId: ChainIdentifier): TProverType {
    const network = this.getChain(Number(chainId));
    return network.defaultProver;
  }

  getAvailableProvers(chainId: ChainIdentifier): TProverType[] {
    const network = this.getChain(Number(chainId));
    if (!network.provers) {
      return [];
    }
    return Object.entries(network.provers)
      .filter(([_, addr]) => addr !== undefined)
      .map(([key]) => key as TProverType);
  }

  /**
   * Gets the HTTP configuration for a network with WebSocket transport.
   * If the http field is not defined in the WebSocket config, creates a default
   * by converting WebSocket URLs to HTTPS with a 60-second polling interval.
   * @param network The network configuration
   * @returns The HTTP RPC configuration or undefined if not a WebSocket network
   */
  getHttpConfigForWebSocket(network: EvmNetworkConfig): z.infer<typeof EvmRpcSchema> | undefined {
    const wsOptions = EvmWsSchema.safeParse(network.rpc);

    if (!wsOptions.success) {
      // Not a WebSocket configuration
      return undefined;
    }

    const { urls, http: httpConfig } = wsOptions.data;

    if (httpConfig) {
      // HTTP config is explicitly defined - already validated by schema
      return httpConfig;
    }

    // Create default HTTP config from WebSocket URLs
    const httpUrls = urls.map((url) => url.replace(/^wss?:/, 'https:'));
    const defaultHttpConfig = {
      urls: httpUrls,
      pollingInterval: 60_000, // 60 seconds default for HTTP fallback
    };

    // Parse and validate using EvmRpcSchema
    return EvmRpcSchema.parse(defaultHttpConfig);
  }

  private initializeNetworks(): void {
    const networks = this.configService.get<EvmNetworkConfig[]>('evm.networks', []);
    for (const network of networks) {
      this._networks.set(network.chainId, network);
    }
  }
}
