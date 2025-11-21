import { Injectable, OnModuleInit } from '@nestjs/common';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverResult, ProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { BlockchainConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { CcipProver } from '@/modules/prover/provers/ccip.prover';
import { DummyProver } from '@/modules/prover/provers/dummy.prover';
import { HyperProver } from '@/modules/prover/provers/hyper.prover';
import { MetalayerProver } from '@/modules/prover/provers/metalayer.prover';
import { PolymerProver } from '@/modules/prover/provers/polymer.prover';

@Injectable()
export class ProverService implements OnModuleInit {
  private readonly provers: Map<string, BaseProver> = new Map();

  constructor(
    private hyperProver: HyperProver,
    private polymerProver: PolymerProver,
    private metalayerProver: MetalayerProver,
    private dummyProver: DummyProver,
    private ccipProver: CcipProver,
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
    const sourceChainId = Number(intent.sourceChainId);
    const destinationChainId = Number(intent.destination);

    if (sourceChainId === destinationChainId) {
      return { isValid: false, reason: 'Cannot fulfill on the same chain' };
    }

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
    const prover = this.getProver(sourceChainId, intent.reward.prover);
    if (!prover || !prover.isSupported(destinationChainId)) {
      return {
        isValid: false,
        reason: 'Intent prover is not allowed',
      };
    }

    return { isValid: true };
  }

  getProver(chainId: number, address: UniversalAddress) {
    for (const prover of this.provers.values()) {
      const proverAddr = prover.getContractAddress(chainId);

      if (proverAddr && proverAddr === address) {
        return prover;
      }
    }
    return null;
  }

  findProverForRoute(sourceChainId: number, destinationChainId: number): BaseProver | null {
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

  private initializeProvers(): void {
    this.provers.set(ProverType.HYPER, this.hyperProver);
    this.provers.set(ProverType.POLYMER, this.polymerProver);
    this.provers.set(ProverType.METALAYER, this.metalayerProver);
    this.provers.set(ProverType.DUMMY, this.dummyProver);
    this.provers.set(ProverType.CCIP, this.ccipProver);

    this.logger.log(`Initialized ${this.provers.size} provers`);
  }
}
