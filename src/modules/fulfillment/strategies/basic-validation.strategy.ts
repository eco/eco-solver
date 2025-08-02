import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService, SolanaConfigService } from '@/modules/config/services';
import { ValidationStrategy } from '@/modules/fulfillment/strategies/validation-strategy.interface';

@Injectable()
export class BasicValidationStrategy implements ValidationStrategy {
  constructor(
    private evmConfigService: EvmConfigService,
    private solanaConfigService: SolanaConfigService,
  ) {}

  async validate(intent: Intent): Promise<boolean> {
    try {
      // Check deadline
      if (intent.deadline <= Math.floor(Date.now() / 1000)) {
        console.log(`Intent ${intent.intentId} has expired`);
        return false;
      }

      // Check if solver address matches configured address
      const expectedSolver = this.getSolverAddressForChain(intent.source.chainId);
      if (intent.solver.toLowerCase() !== expectedSolver.toLowerCase()) {
        console.log(`Intent ${intent.intentId} solver mismatch`);
        return false;
      }

      // Check reward is greater than 0
      if (BigInt(intent.reward) <= 0n) {
        console.log(`Intent ${intent.intentId} has no reward`);
        return false;
      }

      // Additional validation logic can be added here

      return true;
    } catch (error) {
      console.error(`Validation error for intent ${intent.intentId}:`, error);
      return false;
    }
  }

  private getSolverAddressForChain(chainId: string | number): string {
    // Return solver address based on chain
    if (typeof chainId === 'number') {
      return this.evmConfigService.walletAddress;
    } else if (chainId === 'solana-mainnet') {
      return this.solanaConfigService.walletAddress;
    }
    return 'solver-address'; // Placeholder for other chains
  }
}
