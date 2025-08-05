import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

import { Validation } from './validation.interface';

@Injectable()
export class ExpirationValidation implements Validation {
  constructor(private readonly fulfillmentConfigService: FulfillmentConfigService) {}

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

    // Add a buffer to ensure we have enough time to execute
    const bufferSeconds = BigInt(this.fulfillmentConfigService.deadlineDuration);
    if (intent.reward.deadline <= currentTimestamp + bufferSeconds) {
      throw new Error(
        `Intent deadline ${intent.reward.deadline} is too close. Need at least ${bufferSeconds} seconds buffer`,
      );
    }

    return true;
  }
}
