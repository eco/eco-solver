import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';

import { Validation } from './validation.interface';

@Injectable()
export class FundingValidation implements Validation {
  async validate(intent: Intent): Promise<boolean> {
    // TODO: Implement on-chain funding check
    // This should verify that the intent has been funded with the required amount
    // on the source chain by checking the intent contract

    // Check native value
    if (intent.reward.nativeValue && intent.reward.nativeValue > 0n) {
      // Native token funding validation
      // TODO: Verify on-chain that native tokens are locked
    }

    // Check token funding
    if (intent.route.tokens && intent.route.tokens.length > 0) {
      for (const token of intent.route.tokens) {
        if (token.amount <= 0n) {
          throw new Error(`Token ${token.token} amount must be greater than 0`);
        }
        // TODO: Verify on-chain that tokens are approved and can be transferred
      }
    }

    // Check if there's any value being transferred (either native or tokens)
    const hasNativeValue = intent.reward.nativeValue > 0n;
    const hasTokenValue = intent.route.tokens && intent.route.tokens.length > 0;
    const hasCallValue = intent.route.calls && intent.route.calls.some((call) => call.value > 0n);

    if (!hasNativeValue && !hasTokenValue && !hasCallValue) {
      throw new Error('Intent must have some value (native, tokens, or call value)');
    }

    // TODO: Add actual on-chain funding verification
    // 1. Get the intent contract address from config
    // 2. Call the contract to check if the intent is funded
    // 3. Verify the funded amount matches the expected values

    return true;
  }
}
