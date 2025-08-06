import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

import { Validation } from './validation.interface';

@Injectable()
export class RouteTokenValidation implements Validation {
  constructor(private evmConfigService: EvmConfigService) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const destinationChainId = Number(intent.route.destination);

    const nativeTokenAmount = intent.route.calls.reduce((acc, call) => acc + call.value, 0n);
    if (nativeTokenAmount !== 0n) {
      throw new Error(`Native token transfers are not supported`);
    }

    // Validate route tokens
    for (const routeToken of intent.route.tokens) {
      // Check if token is supported when there are restrictions
      if (!this.evmConfigService.isTokenSupported(destinationChainId, routeToken.token)) {
        throw new Error(
          `Token ${routeToken.token} is not supported on chain ${destinationChainId}`,
        );
      }
    }

    // Validate reward tokens (on source chain)
    const sourceChainId = Number(intent.route.source);
    for (const token of intent.reward.tokens) {
      // Check if reward token is supported when there are restrictions
      if (!this.evmConfigService.isTokenSupported(sourceChainId, token.token)) {
        throw new Error(`Reward token ${token.token} is not supported on chain ${sourceChainId}`);
      }
    }

    return true;
  }
}
