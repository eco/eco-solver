import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TProverType } from '@/common/interfaces/prover.interface';
import { BlockchainAddress, UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { SolanaConfig } from '@/config/schemas';
import { SvmAddress } from '@/modules/blockchain/svm/types/address.types';
import { ChainIdentifier } from '@/modules/token/types/token.types';

import { IBlockchainConfigService, TokenConfig } from '../interfaces/blockchain-config.interface';

@Injectable()
export class SolanaConfigService implements IBlockchainConfigService {
  constructor(private configService: ConfigService) {}

  get chainId(): SolanaConfig['chainId'] {
    return this.configService.get<number>('svm.chainId')!;
  }

  get rpcUrl(): SolanaConfig['rpcUrl'] {
    return this.configService.get<string>('svm.rpcUrl')!;
  }

  get wsUrl(): SolanaConfig['wsUrl'] {
    return this.configService.get<string>('svm.wsUrl');
  }

  get wallets(): SolanaConfig['wallets'] {
    return this.configService.get<SolanaConfig['wallets']>('svm.wallets')!;
  }

  get fee(): SolanaConfig['fee'] {
    return this.configService.get<SolanaConfig['fee']>('svm.fee')!;
  }

  get tokens(): SolanaConfig['tokens'] {
    return this.configService.get<SolanaConfig['tokens']>('svm.tokens')!;
  }

  get portalProgramId() {
    return this.configService.get<SvmAddress>('svm.portalProgramId')!;
  }

  get listenersEnabled(): boolean {
    return this.configService.get<boolean>('svm.listenersEnabled') ?? true;
  }

  get hyperlane(): SolanaConfig['hyperlane'] {
    return this.configService.get<SolanaConfig['hyperlane']>('svm.hyperlane');
  }

  isConfigured(): boolean {
    // Check if essential Solana configuration is present
    const config = this.configService.get('svm');
    return !!(config && config.rpcUrl && config.wallets && config.portalProgramId);
  }

  getSupportedChainIds(): number[] {
    // Return Solana network identifiers if configured
    if (!this.isConfigured()) {
      return [];
    }
    return [this.chainId];
  }

  getPortalAddress(_chainId: ChainIdentifier): UniversalAddress {
    // For Solana, return the portal program ID
    const portalId = this.portalProgramId;
    if (!portalId) {
      throw new Error('Solana portal program ID not configured');
    }
    return AddressNormalizer.normalizeSvm(portalId);
  }

  isTokenSupported(_chainId: ChainIdentifier, tokenAddress: UniversalAddress): boolean {
    const normalizedAddress = AddressNormalizer.denormalizeToSvm(tokenAddress);
    return this.tokens.some(
      (token) => token.address.toLowerCase() === normalizedAddress.toLowerCase(),
    );
  }

  getSupportedTokens(): TokenConfig[] {
    return this.tokens.map((token) => ({
      address: AddressNormalizer.normalizeSvm(token.address),
      decimals: token.decimals,
      symbol: token.symbol,
      limit: token.limit,
      fee: token.fee,
      nonSwapGroups: token.nonSwapGroups,
    }));
  }

  getTokenConfig(chainId: ChainIdentifier, tokenAddress: UniversalAddress): TokenConfig {
    const tokenConfig = this.tokens.find(
      (token) => AddressNormalizer.normalizeSvm(token.address) === tokenAddress,
    );
    if (!tokenConfig) {
      throw new Error(`Unable to get token ${tokenAddress} config for chainId: ${chainId}`);
    }

    return {
      address: AddressNormalizer.normalizeSvm(tokenConfig.address),
      decimals: tokenConfig.decimals,
      symbol: tokenConfig.symbol,
      limit: tokenConfig.limit,
      fee: tokenConfig.fee,
      nonSwapGroups: tokenConfig.nonSwapGroups,
    };
  }

  getFeeLogic(_chainId: ChainIdentifier): SolanaConfig['fee'] {
    return this.fee;
  }

  getProverAddress(
    _chainId: ChainIdentifier,
    proverType: TProverType,
  ): UniversalAddress | undefined {
    // Get prover address from configuration
    const provers = this.configService.get<Record<string, BlockchainAddress>>('svm.provers');
    if (provers && provers[proverType]) {
      return AddressNormalizer.normalize(provers[proverType], ChainType.SVM);
    }
    return undefined;
  }

  getClaimant(_chainId: ChainIdentifier): UniversalAddress {
    const claimant = this.configService.get<SvmAddress>('svm.claimant');
    if (!claimant) {
      throw new Error('Solana claimant address not configured');
    }
    return AddressNormalizer.normalizeSvm(claimant);
  }

  /**
   * Gets the default prover type for Solana
   * @param _chainId Chain identifier (unused for Solana)
   * @returns Default prover type from configuration or 'hyper' as fallback
   */
  getDefaultProver(_chainId: ChainIdentifier): TProverType {
    return this.configService.get<TProverType>('svm.defaultProver')!;
  }

  get proofPollingEnabled(): boolean {
    return this.configService.get<boolean>('svm.proofPolling.enabled') ?? true;
  }

  get proofPollingIntervalMs(): number {
    const seconds = this.configService.get<number>('svm.proofPolling.intervalSeconds') ?? 30;
    return seconds * 1000;
  }

  get proofPollingBatchSize(): number {
    return this.configService.get<number>('svm.proofPolling.batchSize') ?? 100;
  }
}
