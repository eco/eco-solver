import { Injectable, OnModuleInit } from '@nestjs/common';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverResult, ProverType, TProverType } from '@/common/interfaces/prover.interface';
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
  private readonly routeProverCache = new Map<string, TProverType>();

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

  /**
   * Selects the appropriate prover for a route based on chain compatibility
   * Prefers the default prover if it supports both chains, otherwise uses first available
   * Results are cached in-memory since configuration is static
   * @param sourceChainId Source chain ID
   * @param destinationChainId Destination chain ID
   * @returns The selected prover type
   * @throws Error if no compatible prover found
   */
  selectProverForRoute(sourceChainId: bigint, destinationChainId: bigint): TProverType {
    // Generate cache key
    const cacheKey = `${sourceChainId}:${destinationChainId}`;

    // Check cache
    const cached = this.routeProverCache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for route ${cacheKey} -> ${cached}`);
      return cached;
    }

    // Get available provers on source chain
    const sourceProvers = this.blockchainConfigService.getAvailableProvers(sourceChainId);

    // Get available provers on destination chain
    const destProvers = this.blockchainConfigService.getAvailableProvers(destinationChainId);

    // Find intersection of provers
    const availableProvers = sourceProvers.filter((p) => destProvers.includes(p));

    if (availableProvers.length === 0) {
      const message =
        `No compatible prover found for route ${sourceChainId} -> ${destinationChainId}. ` +
        `Source chain provers: [${sourceProvers.join(', ')}], ` +
        `Destination chain provers: [${destProvers.join(', ')}]`;
      this.logger.error(message);
      throw new Error(message);
    }

    // Check if default prover is available
    const defaultProver = this.blockchainConfigService.getDefaultProver(sourceChainId);
    const selectedProver = availableProvers.includes(defaultProver)
      ? defaultProver
      : availableProvers[0];

    // Cache the result
    this.routeProverCache.set(cacheKey, selectedProver);

    this.logger.debug(
      `Selected prover ${selectedProver} for route ${cacheKey} (${availableProvers.includes(defaultProver) ? 'default' : 'fallback'})`,
    );

    return selectedProver;
  }

  /**
   * Clears the route prover cache
   * Useful for testing or if dynamic prover configuration is added in the future
   */
  clearRouteProverCache(): void {
    this.routeProverCache.clear();
    this.logger.debug('Route prover cache cleared');
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
