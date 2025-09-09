import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TProverType } from '@/common/interfaces/prover.interface';
import { BlockchainAddress, UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { SolanaConfig } from '@/config/schemas';
import { SvmAddress } from '@/modules/blockchain/svm/types/address.types';
import { ChainIdentifier } from '@/modules/token/types/token.types';

import { IBlockchainConfigService } from '../interfaces/blockchain-config.interface';

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

  get secretKey(): SolanaConfig['secretKey'] {
    return this.configService.get<string>('svm.secretKey')!;
  }

  get fee(): SolanaConfig['fee'] {
    return this.configService.get<SolanaConfig['fee']>('svm.fee')!;
  }

  get tokens(): SolanaConfig['tokens'] {
    return this.configService.get<SolanaConfig['tokens']>('svm.tokens')!;
  }

  get walletAddress(): SolanaConfig['walletAddress'] {
    return this.configService.get<SvmAddress>('svm.walletAddress');
  }

  get portalProgramId(): SolanaConfig['portalProgramId'] {
    return this.configService.get<SvmAddress>('svm.portalProgramId')!;
  }

  isConfigured(): boolean {
    // Check if essential Solana configuration is present
    const config = this.configService.get('solana');
    return !!(config && config.rpcUrl && config.secretKey && config.portalProgramId);
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
    return AddressNormalizer.normalize(portalId as any, ChainType.SVM);
  }

  isTokenSupported(_chainId: ChainIdentifier, tokenAddress: UniversalAddress): boolean {
    const normalizedAddress = AddressNormalizer.denormalizeToSvm(tokenAddress);
    return this.tokens.some(
      (token) => token.address.toLowerCase() === normalizedAddress.toLowerCase(),
    );
  }

  getSupportedTokens(_chainId: ChainIdentifier): Array<{
    address: UniversalAddress;
    decimals: number;
    limit?: number | { min?: number; max?: number };
  }> {
    return this.tokens.map((token) => ({
      address: AddressNormalizer.normalizeSvm(token.address),
      decimals: token.decimals,
      limit: token.limit,
    }));
  }

  getTokenConfig(
    chainId: ChainIdentifier,
    tokenAddress: UniversalAddress,
  ): {
    address: UniversalAddress;
    decimals: number;
    limit?: number | { min?: number; max?: number };
  } {
    const tokenConfig = this.tokens.find(
      (token) => AddressNormalizer.normalizeSvm(token.address) === tokenAddress,
    );
    if (!tokenConfig) {
      throw new Error(`Unable to get token ${tokenAddress} config for chainId: ${chainId}`);
    }

    return {
      address: AddressNormalizer.normalizeSvm(tokenConfig.address),
      decimals: tokenConfig.decimals,
      limit: tokenConfig.limit,
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
}
