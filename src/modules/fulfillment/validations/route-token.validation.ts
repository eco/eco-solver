import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';

import { Validation } from './validation.interface';

@Injectable()
export class RouteTokenValidation implements Validation {
  constructor(private evmConfigService: EvmConfigService) {}

  async validate(intent: Intent): Promise<boolean> {
    const destinationChainId = Number(intent.route.destination);

    // Validate route tokens
    if (intent.route.tokens && intent.route.tokens.length > 0) {
      const supportedTokens = this.evmConfigService.getSupportedTokens(destinationChainId);
      const hasTokenRestrictions = supportedTokens.length > 0;

      for (const token of intent.route.tokens) {
        if (!token.token || token.token === '0x0000000000000000000000000000000000000000') {
          throw new Error('Invalid token address');
        }

        // Check if token is supported when there are restrictions
        if (
          hasTokenRestrictions &&
          !this.evmConfigService.isTokenSupported(destinationChainId, token.token)
        ) {
          throw new Error(`Token ${token.token} is not supported on chain ${destinationChainId}`);
        }

        // Check token limits if supported
        if (hasTokenRestrictions) {
          const tokenConfig = this.evmConfigService.getTokenConfig(destinationChainId, token.token);
          if (tokenConfig && BigInt(tokenConfig.limit) < token.amount) {
            throw new Error(
              `Token ${token.token} amount ${token.amount} exceeds limit ${tokenConfig.limit} on chain ${destinationChainId}`,
            );
          }
        }
      }
    }

    // Validate reward tokens (on source chain)
    const sourceChainId = Number(intent.route.source);
    if (intent.reward.tokens && intent.reward.tokens.length > 0) {
      const supportedTokens = this.evmConfigService.getSupportedTokens(sourceChainId);
      const hasTokenRestrictions = supportedTokens.length > 0;

      for (const token of intent.reward.tokens) {
        if (!token.token || token.token === '0x0000000000000000000000000000000000000000') {
          throw new Error('Invalid reward token address');
        }

        // Check if reward token is supported when there are restrictions
        if (
          hasTokenRestrictions &&
          !this.evmConfigService.isTokenSupported(sourceChainId, token.token)
        ) {
          throw new Error(`Reward token ${token.token} is not supported on chain ${sourceChainId}`);
        }
      }
    }

    return true;
  }
}
