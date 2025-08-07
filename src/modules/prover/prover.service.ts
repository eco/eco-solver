import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { Address, isAddressEqual } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { ProverResult, ProverType } from '@/common/interfaces/prover.interface';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';
import { MetalayerProver } from '@/modules/prover/provers/metalayer.prover';

@Injectable()
export class ProverService implements OnModuleInit {
  private readonly logger = new Logger(ProverService.name);
  private readonly provers: Map<string, HyperProver | MetalayerProver> = new Map();

  constructor(
    private hyperProver: HyperProver,
    private metalayerProver: MetalayerProver,
  ) {}

  onModuleInit() {
    this.initializeProvers();
  }

  async validateIntentRoute(intent: Intent): Promise<ProverResult> {
    // Find the appropriate prover based on the contract addresses
    const prover = this.findProverForRoute(
      Number(intent.route.source),
      Number(intent.route.destination),
    );

    if (!prover) {
      return {
        isValid: false,
        reason: 'No prover found for this route',
      };
    }

    return { isValid: true };
  }

  getProver(chainId: number, address: Address) {
    for (const prover of this.provers.values()) {
      const proverAddr = prover.getContractAddress(chainId);

      if (proverAddr && isAddressEqual(proverAddr, address)) {
        return prover;
      }
    }
    return null;
  }

  private initializeProvers(): void {
    this.provers.set(ProverType.HYPER, this.hyperProver);
    this.provers.set(ProverType.METALAYER, this.metalayerProver);

    this.logger.log(`Initialized ${this.provers.size} provers`);
  }

  getMaxDeadlineBuffer(source: number, destination: number): bigint {
    let maxBuffer = 0n;
    
    // Check each prover that supports this route and find the maximum deadline buffer
    for (const prover of this.provers.values()) {
      const sourceSupported = prover.isSupported(source);
      const destinationSupported = prover.isSupported(destination);

      if (sourceSupported && destinationSupported) {
        const buffer = prover.getDeadlineBuffer();
        if (buffer > maxBuffer) {
          maxBuffer = buffer;
        }
      }
    }

    // If no prover supports this route, return a default buffer (5 minutes)
    return maxBuffer > 0n ? maxBuffer : 300n;
  }

  private findProverForRoute(
    source: number,
    destination: number,
  ): HyperProver | MetalayerProver | null {
    // Check each prover to see if it supports both chains and has matching contracts
    for (const [type, prover] of this.provers) {
      const sourceContract = prover.isSupported(source);
      const destinationContract = prover.isSupported(destination);

      if (sourceContract && destinationContract) {
        this.logger.debug(`Found prover ${type} for route ${source} -> ${destination}`);
        return prover;
      }
    }

    return null;
  }
}
