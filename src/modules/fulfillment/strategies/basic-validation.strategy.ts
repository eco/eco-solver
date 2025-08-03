import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationStrategy } from '@/modules/fulfillment/strategies/validation-strategy.interface';

@Injectable()
export class BasicValidationStrategy implements ValidationStrategy {
  constructor() {}

  async validate(intent: Intent): Promise<boolean> {
    try {
      // Check deadline
      if (intent.reward.deadline <= Math.floor(Date.now() / 1000)) {
        console.log(`Intent ${intent.intentHash} has expired`);
        return false;
      }

      // Additional validation logic can be added here

      return true;
    } catch (error) {
      console.error(`Validation error for intent ${intent.intentHash}:`, error);
      return false;
    }
  }
}
