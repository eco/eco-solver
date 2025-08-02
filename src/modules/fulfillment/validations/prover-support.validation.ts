import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';
import { ProverService } from '@/modules/prover/prover.service';

@Injectable()
export class ProverSupportValidation implements Validation {
  constructor(private readonly proverService: ProverService) {}

  async validate(intent: Intent): Promise<boolean> {
    // Validate that the prover supports this route
    const proverResult = await this.proverService.validateRoute(
      Number(intent.source.chainId),
      Number(intent.target.chainId),
      intent.source.address,
    );

    if (!proverResult.isValid) {
      throw new Error(`Prover validation failed: ${proverResult.reason || 'Unknown reason'}`);
    }

    return true;
  }
}