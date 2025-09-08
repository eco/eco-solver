import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { TProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { SolanaSchema } from '@/config/config.schema';
import { AssetsFeeSchemaType } from '@/config/schemas/fee.schema';
import { SvmAddress } from '@/modules/blockchain/svm/types/address.types';
import { ChainIdentifier } from '@/modules/token/types/token.types';

import { IBlockchainConfigService } from '../interfaces/blockchain-config.interface';

type SolanaConfig = z.infer<typeof SolanaSchema>;

@Injectable()
export class SolanaConfigService implements IBlockchainConfigService {
  constructor(private configService: ConfigService) {}

  get chainId(): SolanaConfig['chainId'] {
    return this.configService.get<string>('solana.chainId')!;
  }

  get rpcUrl(): SolanaConfig['rpcUrl'] {
    return this.configService.get<string>('solana.rpcUrl')!;
  }

  get wsUrl(): SolanaConfig['wsUrl'] {
    return this.configService.get<string>('solana.wsUrl');
  }

  get secretKey(): SolanaConfig['secretKey'] {
    return this.configService.get<string>('solana.secretKey')!;
  }

  get walletAddress(): SolanaConfig['walletAddress'] {
    return this.configService.get<SvmAddress>('solana.walletAddress');
  }

  get programId(): SolanaConfig['programId'] {
    return this.configService.get<SvmAddress>('solana.programId')!;
  }

  get portalProgramId(): SolanaConfig['portalProgramId'] {
    return this.configService.get<SvmAddress>('solana.portalProgramId')!;
  }

  isConfigured(): boolean {
    // Check if essential Solana configuration is present
    const config = this.configService.get('solana');
    return !!(config && config.rpcUrl && config.secretKey && config.portalProgramId);
  }

  getSupportedChainIds(): (number | string)[] {
    // Return Solana network identifiers if configured
    if (!this.isConfigured()) {
      return [];
    }
    // Return standard Solana network identifiers
    return ['solana-mainnet', 'solana-devnet', 'solana-testnet'];
  }

  getPortalAddress(_chainId: ChainIdentifier): UniversalAddress {
    // For Solana, return the portal program ID
    const portalId = this.portalProgramId;
    if (!portalId) {
      throw new Error('Solana portal program ID not configured');
    }
    return AddressNormalizer.normalize(portalId as any, ChainType.SVM);
  }

  getSupportedTokens(_chainId: ChainIdentifier): Array<{
    address: UniversalAddress;
    decimals: number;
    limit?: number | { min?: number; max?: number };
  }> {
    // Solana doesn't have token restrictions in current configuration
    // Return empty array to indicate all SPL tokens are supported
    return [];
  }

  isTokenSupported(_chainId: ChainIdentifier, _tokenAddress: UniversalAddress): boolean {
    // For Solana, all SPL tokens are supported by default
    // This can be extended in the future if token restrictions are added
    return true;
  }

  getTokenConfig(
    _chainId: ChainIdentifier,
    tokenAddress: UniversalAddress,
  ): {
    address: UniversalAddress;
    decimals: number;
    limit?: number | { min?: number; max?: number };
  } {
    // Return default configuration for Solana SPL tokens
    // Decimals default to 9 for most SPL tokens
    return {
      address: tokenAddress,
      decimals: 9,
    };
  }

  getFeeLogic(_chainId: ChainIdentifier): AssetsFeeSchemaType {
    // Return default fee configuration for Solana
    // This can be extended when Solana fee configuration is added to schema
    return {
      native: {
        flatFee: 0, // 0.000005 SOL (5000 lamports)
        scalarBps: 0, // No percentage fee for native
      },
      tokens: {
        flatFee: 0, // Very low flat fee for tokens (1 microtoken equivalent)
        scalarBps: 0, // 0.01% fee (much lower than EVM's 0.1%)
      },
    };
  }

  getProverAddress(
    _chainId: ChainIdentifier,
    proverType: TProverType,
  ): UniversalAddress | undefined {
    // Get prover address from configuration
    const provers = this.configService.get<Record<string, string>>('solana.provers');
    if (provers && provers[proverType]) {
      return AddressNormalizer.normalize(provers[proverType] as any, ChainType.SVM);
    }
    return undefined;
  }

  getClaimant(_chainId: ChainIdentifier): UniversalAddress {
    const claimant = this.configService.get<string>('solana.claimant');
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
    const defaultProver = this.configService.get<TProverType>('solana.defaultProver');
    return defaultProver || 'hyper';
  }
}
