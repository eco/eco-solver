import { Injectable } from '@nestjs/common';
import { Intent } from '@/common/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class ExpirationValidation implements Validation {
  async validate(intent: Intent): Promise<boolean> {
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    
    if (!intent.reward.deadline) {
      throw new Error('Intent must have a deadline');
    }

    if (intent.reward.deadline <= currentTimestamp) {
      throw new Error(`Intent deadline ${intent.reward.deadline} has expired. Current time: ${currentTimestamp}`);
    }

    // Add a buffer to ensure we have enough time to execute
    const bufferSeconds = BigInt(60); // 1 minute buffer
    if (intent.reward.deadline <= currentTimestamp + bufferSeconds) {
      throw new Error(`Intent deadline ${intent.reward.deadline} is too close. Need at least ${bufferSeconds} seconds buffer`);
    }

    return true;
  }
}