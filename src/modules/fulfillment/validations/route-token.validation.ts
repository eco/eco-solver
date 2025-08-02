import { Injectable } from '@nestjs/common';
import { Intent } from '@/modules/intents/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class RouteTokenValidation implements Validation {
  // TODO: Inject configuration service to get supported tokens
  private supportedTokens: Set<string> = new Set([
    // Add supported token addresses here
  ]);

  async validate(intent: Intent): Promise<boolean> {
    // TODO: Implement route and reward token validation
    // This should check if the route tokens (source and target) are supported
    // and if the reward token is supported
    
    // For now, we'll do basic validation
    if (!intent.source?.address || !intent.target?.address) {
      throw new Error('Intent must have source and target addresses');
    }

    // TODO: Add actual token validation
    // 1. Extract token addresses from intent data
    // 2. Check if source token is supported
    // 3. Check if target token is supported
    // 4. Check if reward token is supported
    
    return true;
  }
}