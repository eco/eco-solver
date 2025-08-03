import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import {
  ProverChainConfig,
  ProverResult,
  ProverRoute,
  ProverType,
} from '@/common/interfaces/prover.interface';
import { ProverConfigService } from '@/modules/prover/prover-config.service';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';
import { MetalayerProver } from '@/modules/prover/provers/metalayer.prover';

@Injectable()
export class ProverService implements OnModuleInit {
  private readonly logger = new Logger(ProverService.name);
  private readonly provers: Map<string, HyperProver | MetalayerProver> = new Map();

  constructor(
    private proverConfigService: ProverConfigService,
    private hyperProver: HyperProver,
    private metalayerProver: MetalayerProver,
  ) {}

  onModuleInit() {
    this.initializeProvers();
  }

  private initializeProvers(): void {
    const proverConfigs = this.proverConfigService.provers;

    proverConfigs.forEach((config) => {
      switch (config.type) {
        case ProverType.HYPER:
          this.hyperProver.configure(config.chainConfigs as ProverChainConfig[]);
          this.provers.set(ProverType.HYPER, this.hyperProver);
          break;
        case ProverType.METALAYER:
          this.metalayerProver.configure(config.chainConfigs as ProverChainConfig[]);
          this.provers.set(ProverType.METALAYER, this.metalayerProver);
          break;
        default:
          this.logger.warn(`Unknown prover type: ${config.type}`);
      }
    });

    this.logger.log(`Initialized ${this.provers.size} provers`);
  }

  async validateIntentRoute(intent: Intent): Promise<ProverResult> {
    const route: ProverRoute = {
      source: {
        chainId: Number(intent.route.source),
        contract: intent.reward.prover, // Using prover address as source contract
      },
      target: {
        chainId: Number(intent.route.destination),
        contract: intent.route.inbox,
      },
      intentId: intent.intentHash,
    };

    // Find the appropriate prover based on the contract addresses
    const prover = this.findProverForRoute(route);

    if (!prover) {
      return {
        isValid: false,
        reason: 'No prover found for this route',
      };
    }

    return prover.validateRoute(route);
  }

  private findProverForRoute(route: ProverRoute): HyperProver | MetalayerProver | null {
    // Check each prover to see if it supports both chains and has matching contracts
    for (const [type, prover] of this.provers) {
      const sourceContract = prover.getContractAddress(route.source.chainId);
      const targetContract = prover.getContractAddress(route.target.chainId);

      if (
        sourceContract &&
        targetContract &&
        sourceContract.toLowerCase() === route.source.contract.toLowerCase() &&
        targetContract.toLowerCase() === route.target.contract.toLowerCase()
      ) {
        this.logger.debug(
          `Found prover ${type} for route ${route.source.chainId} -> ${route.target.chainId}`,
        );
        return prover;
      }
    }

    return null;
  }

  getProverForChainAndContract(chainId: string | number, contractAddress: string): string | null {
    for (const [type, prover] of this.provers) {
      const configuredAddress = prover.getContractAddress(chainId);
      if (configuredAddress && configuredAddress.toLowerCase() === contractAddress.toLowerCase()) {
        return type;
      }
    }
    return null;
  }
}
