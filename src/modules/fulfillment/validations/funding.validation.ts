import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';

import { Validation } from './validation.interface';

@Injectable()
export class FundingValidation implements Validation {
  async validate(intent: Intent): Promise<boolean> {
    for (const token of intent.route.tokens) {
      if (token.amount <= 0n) {
        throw new Error(`Token ${token.token} amount must be greater than 0`);
      }
      // TODO: Verify on-chain that tokens are approved and can be transferred
    }

    // TODO: Add actual on-chain funding verification
    // 1. Get the intent contract address from config
    // 2. Call the contract to check if the intent is funded
    // 3. Verify the funded amount matches the expected values

    return true;
  }
}
