import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

import { Validation } from './validation.interface';

export interface FeeDetails {
  // Reward information (what the user provides)
  reward: {
    native: bigint; // Native reward amount
    tokens: bigint; // Token reward amount
  };

  // Route information (what gets transferred)
  route: {
    native: bigint; // Native amount in the route
    tokens: bigint; // Token amount in the route
    maximum: {
      native: bigint; // Maximum native that can be transferred (reward.native - fee.total for native routes)
      tokens: bigint; // Maximum tokens that can be transferred (reward.tokens - fee.total for token routes)
    };
  };

  // Fee breakdown
  fee: {
    base: bigint; // Fixed base fee
    percentage: bigint; // Percentage fee (calculated from reward.tokens for token transfers or reward.native for native)
    total: bigint; // Total fee (base + percentage)
    bps: number; // Basis points used for percentage calculation
  };
}

export interface FeeCalculationValidation extends Validation {
  /**
   * Calculate the fees for the intent
   * @param intent The intent to calculate fees for
   * @param context The validation context providing necessary blockchain information
   * @returns Fee calculation details
   */
  calculateFee(intent: Intent, context: ValidationContext): Promise<FeeDetails>;
}
