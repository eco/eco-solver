import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { ProverService } from '@/modules/prover/prover.service';

import { Validation } from './validation.interface';

@Injectable()
export class ProverSupportValidation implements Validation {
  constructor(private readonly proverService: ProverService) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    // Validate that the prover supports this route
    const proverResult = await this.proverService.validateIntentRoute(intent);

    if (!proverResult.isValid) {
      throw new Error(`Prover validation failed: ${proverResult.reason || 'Unknown reason'}`);
    }

    return true;
  }
}
