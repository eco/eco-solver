import { Injectable } from '@nestjs/common';
import { Intent } from '@/common/interfaces/intent.interface';
import { Validation } from './validation.interface';
import { ProverService } from '@/modules/prover/prover.service';

@Injectable()
export class ProverSupportValidation implements Validation {
  constructor(private readonly proverService: ProverService) {}

  async validate(intent: Intent): Promise<boolean> {
    // Validate that the prover supports this route
    const proverResult = await this.proverService.validateRoute(
      Number(intent.route.source),
      Number(intent.route.destination),
      intent.route.inbox,
    );

    if (!proverResult.isValid) {
      throw new Error(`Prover validation failed: ${proverResult.reason || 'Unknown reason'}`);
    }

    return true;
  }
}