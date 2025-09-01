import { Injectable, OnModuleInit } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { ProverResult, ProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { BlockchainConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';
import { MetalayerProver } from '@/modules/prover/provers/metalayer.prover';

@Injectable()
export class ProverService implements OnModuleInit {
  private readonly provers: Map<string, HyperProver | MetalayerProver> = new Map();

  constructor(
    private hyperProver: HyperProver,
    private metalayerProver: MetalayerProver,
    private readonly logger: SystemLoggerService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {
    this.logger.setContext(ProverService.name);
  }

  onModuleInit() {
    this.initializeProvers();
  }

  async validateIntentRoute(intent: Intent): Promise<ProverResult> {
    // Validate Portal address in route
    const portalAddress = intent.route.portal;
    const destinationChainId = Number(intent.destination);
    const expectedPortal = this.blockchainConfigService.getPortalAddress(destinationChainId);

    if (!expectedPortal) {
      return {
        isValid: false,
        reason: `No Portal address configured for destination chain ${destinationChainId}`,
      };
    }

    if (portalAddress !== expectedPortal) {
      return {
        isValid: false,
        reason: `Portal address mismatch: expected ${expectedPortal}, got ${portalAddress}`,
      };
    }

    // Find the appropriate prover based on the contract addresses
    const sourceChainId = intent.sourceChainId ? Number(intent.sourceChainId) : destinationChainId;
    const prover = this.findProverForRoute(sourceChainId, destinationChainId);

    if (!prover) {
      return {
        isValid: false,
        reason: 'No prover found for this route',
      };
    }

    return { isValid: true };
  }

  getProver(chainId: number | string, address: UniversalAddress) {
    for (const prover of this.provers.values()) {
      const proverAddr = prover.getContractAddress(chainId);

      if (proverAddr && proverAddr === address) {
        return prover;
      }
    }
    return null;
  }

  getMaxDeadlineBuffer(sourceChainId: number, destinationChainId: number): bigint {
    let maxBuffer = 0n;

    // Check each prover that supports this route and find the maximum deadline buffer
    for (const prover of this.provers.values()) {
      const sourceSupported = prover.isSupported(sourceChainId);
      const destinationSupported = prover.isSupported(destinationChainId);

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

  /**
   * Validates Portal proof submission capability
   * @param intentHashes Array of intent hashes to validate
   * @param sourceChainId Source chain ID
   * @param destinationChainId Destination chain ID
   * @returns ProverResult indicating if proof can be submitted
   */
  async validateProofSubmission(
    intentHashes: string[],
    sourceChainId: number,
    destinationChainId: number,
  ): Promise<ProverResult> {
    const prover = this.findProverForRoute(sourceChainId, destinationChainId);

    if (!prover) {
      return {
        isValid: false,
        reason: `No prover available for route ${sourceChainId} -> ${destinationChainId}`,
      };
    }

    // Validate that all intent hashes are properly formatted
    for (const intentHash of intentHashes) {
      if (!/^0x[a-fA-F0-9]{64}$/.test(intentHash)) {
        return {
          isValid: false,
          reason: `Invalid intent hash format: ${intentHash}`,
        };
      }
    }

    return { isValid: true };
  }

  private initializeProvers(): void {
    this.provers.set(ProverType.HYPER, this.hyperProver);
    this.provers.set(ProverType.METALAYER, this.metalayerProver);

    this.logger.log(`Initialized ${this.provers.size} provers`);
  }

  private findProverForRoute(
    sourceChainId: number,
    destinationChainId: number,
  ): HyperProver | MetalayerProver | null {
    // Check each prover to see if it supports both chains and has matching contracts
    for (const [type, prover] of this.provers) {
      const sourceContract = prover.isSupported(sourceChainId);
      const destinationContract = prover.isSupported(destinationChainId);

      if (sourceContract && destinationContract) {
        this.logger.debug(
          `Found prover ${type} for route ${sourceChainId} -> ${destinationChainId}`,
        );
        return prover;
      }
    }

    return null;
  }
}
