import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class RouteCallsValidation implements Validation {
  // TODO: Inject configuration service to get supported route calls
  private supportedRouteCalls: Set<string> = new Set([
    // Add supported route call signatures here
  ]);

  async validate(intent: Intent): Promise<boolean> {
    // TODO: Implement route calls validation
    // This should check if the route calls in the intent data are supported
    // by the solver/executor
    
    if (!intent.data) {
      throw new Error('Intent must have data field');
    }

    // TODO: Add actual route calls validation
    // 1. Decode the intent data to extract route calls
    // 2. Check each route call against supported calls
    // 3. Validate call parameters and targets
    
    return true;
  }
}