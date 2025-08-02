import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class ExpirationValidation implements Validation {
  async validate(intent: Intent): Promise<boolean> {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    if (!intent.deadline) {
      throw new Error('Intent must have a deadline');
    }

    if (intent.deadline <= currentTimestamp) {
      throw new Error(`Intent deadline ${intent.deadline} has expired. Current time: ${currentTimestamp}`);
    }

    // Add a buffer to ensure we have enough time to execute
    const bufferSeconds = 60; // 1 minute buffer
    if (intent.deadline <= currentTimestamp + bufferSeconds) {
      throw new Error(`Intent deadline ${intent.deadline} is too close. Need at least ${bufferSeconds} seconds buffer`);
    }

    return true;
  }
}