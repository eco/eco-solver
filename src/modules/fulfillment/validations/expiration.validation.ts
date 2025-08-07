import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { ProverService } from '@/modules/prover/prover.service';

import { Validation } from './validation.interface';

@Injectable()
export class ExpirationValidation implements Validation {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly proverService: ProverService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

    if (!intent.reward.deadline) {
      throw new Error('Intent must have a deadline');
    }

    if (intent.reward.deadline <= currentTimestamp) {
      throw new Error(
        `Intent deadline ${intent.reward.deadline} has expired. Current time: ${currentTimestamp}`,
      );
    }

    // Get the maximum deadline buffer required by provers for this route
    const bufferSeconds = this.proverService.getMaxDeadlineBuffer(
      Number(intent.route.source),
      Number(intent.route.destination),
    );

    if (intent.reward.deadline <= currentTimestamp + bufferSeconds) {
      throw new Error(
        `Intent deadline ${intent.reward.deadline} is too close. Need at least ${bufferSeconds} seconds buffer for this route`,
      );
    }

    return true;
  }
}
