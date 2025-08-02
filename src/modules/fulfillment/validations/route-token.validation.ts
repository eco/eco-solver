import { Injectable } from '@nestjs/common';
import { Intent } from '@/common/interfaces/intent.interface';
import { Validation } from './validation.interface';

@Injectable()
export class RouteTokenValidation implements Validation {
  // TODO: Inject configuration service to get supported tokens
  private supportedTokens: Set<string> = new Set([
    // Add supported token addresses here
  ]);

  async validate(intent: Intent): Promise<boolean> {
    // Validate route tokens
    if (intent.route.tokens && intent.route.tokens.length > 0) {
      for (const token of intent.route.tokens) {
        if (!token.token || token.token === '0x0000000000000000000000000000000000000000') {
          throw new Error('Invalid token address');
        }
        
        // TODO: Check if token is supported (when supportedTokens is populated)
        // if (this.supportedTokens.size > 0 && !this.supportedTokens.has(token.token)) {
        //   throw new Error(`Token ${token.token} is not supported`);
        // }
      }
    }
    
    // Validate reward tokens
    if (intent.reward.tokens && intent.reward.tokens.length > 0) {
      for (const token of intent.reward.tokens) {
        if (!token.token || token.token === '0x0000000000000000000000000000000000000000') {
          throw new Error('Invalid reward token address');
        }
        
        // TODO: Check if reward token is supported
        // if (this.supportedTokens.size > 0 && !this.supportedTokens.has(token.token)) {
        //   throw new Error(`Reward token ${token.token} is not supported`);
        // }
      }
    }
    
    return true;
  }
}