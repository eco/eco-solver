import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class FundingValidation implements Validation {
  async validate(intent: Intent): Promise<boolean> {
    // TODO: Implement on-chain funding check
    // This should verify that the intent has been funded with the required amount
    // on the source chain by checking the intent contract
    // For now, we assume the intent is funded if it exists in our system
    
    if (!intent.value || BigInt(intent.value) <= 0n) {
      throw new Error('Intent value must be greater than 0');
    }

    // TODO: Add actual on-chain funding verification
    // 1. Get the intent contract address from config
    // 2. Call the contract to check if the intent is funded
    // 3. Verify the funded amount matches intent.value
    
    return true;
  }
}