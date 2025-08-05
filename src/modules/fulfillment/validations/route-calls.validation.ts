import { Injectable } from '@nestjs/common';

import { Address, decodeFunctionData, erc20Abi, isAddressEqual } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

import { Validation } from './validation.interface';

@Injectable()
export class RouteCallsValidation implements Validation {
  constructor(private evmConfigService: EvmConfigService) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    // Validate route calls
    if (!intent.route.calls || intent.route.calls.length === 0) {
      // It's valid to have no calls (token-only transfer)
      return true;
    }

    const tokens = this.evmConfigService.getSupportedTokens(intent.route.destination);

    for (const call of intent.route.calls) {
      const isTokenCall = tokens.some((token) =>
        isAddressEqual(token.address as Address, call.target),
      );

      if (!isTokenCall) {
        throw new Error(
          `Invalid route call: target ${call.target} is not a supported token address`,
        );
      }

      try {
        const fn = decodeFunctionData({
          abi: erc20Abi,
          data: call.data,
        });

        if (fn.functionName !== 'transfer') {
          throw new Error(
            `Invalid route call: only ERC20 transfer function is allowed, got ${fn.functionName}`,
          );
        }
      } catch (error) {
        // Invalid ERC20 call data
        throw new Error(
          `Invalid route call: unable to decode ERC20 call data for target ${call.target}`,
        );
      }
    }

    return true;
  }
}
