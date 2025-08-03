import { Injectable, Logger } from '@nestjs/common';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import {
  ProverChainConfig,
  ProverResult,
  ProverRoute,
  ProverType,
} from '@/common/interfaces/prover.interface';

@Injectable()
export class MetalayerProver extends BaseProver {
  private readonly logger = new Logger(MetalayerProver.name);
  readonly type = ProverType.METALAYER;
  private chainConfigs: Map<string, string> = new Map();

  configure(chainConfigs: ProverChainConfig[]): void {
    this.chainConfigs.clear();
    chainConfigs.forEach((config) => {
      const chainKey = String(config.chainId);
      this.chainConfigs.set(chainKey, config.contractAddress);
    });
    this.logger.log(`Configured MetalayerProver with ${chainConfigs.length} chain configs`);
  }

  async validateRoute(route: ProverRoute): Promise<ProverResult> {
    try {
      const sourceSupported = this.isSupported(route.source.chainId);
      const targetSupported = this.isSupported(route.target.chainId);

      if (!sourceSupported || !targetSupported) {
        return {
          isValid: false,
          reason: `Route not supported: source=${sourceSupported}, target=${targetSupported}`,
        };
      }

      const sourceContract = this.getContractAddress(route.source.chainId);
      const targetContract = this.getContractAddress(route.target.chainId);

      if (route.source.contract.toLowerCase() !== sourceContract?.toLowerCase()) {
        return {
          isValid: false,
          reason: `Invalid source contract: expected ${sourceContract}, got ${route.source.contract}`,
        };
      }

      if (route.target.contract.toLowerCase() !== targetContract?.toLowerCase()) {
        return {
          isValid: false,
          reason: `Invalid target contract: expected ${targetContract}, got ${route.target.contract}`,
        };
      }

      // Additional Metalayer-specific validation logic can be added here
      // For example, Metalayer might have different security requirements or route restrictions

      return {
        isValid: true,
        metadata: {
          proverType: this.type,
          sourceChain: route.source.chainId,
          targetChain: route.target.chainId,
        },
      };
    } catch (error) {
      this.logger.error(`Error validating route: ${error.message}`, error.stack);
      return {
        isValid: false,
        reason: `Validation error: ${error.message}`,
      };
    }
  }

  getContractAddress(chainId: string | number): string | undefined {
    const chainKey = String(chainId);
    return this.chainConfigs.get(chainKey);
  }

  isSupported(chainId: string | number): boolean {
    const chainKey = String(chainId);
    return this.chainConfigs.has(chainKey);
  }
}
