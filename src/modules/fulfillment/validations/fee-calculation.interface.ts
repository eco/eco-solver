import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

import { Validation } from './validation.interface';

export interface FeeDetails {
  baseFee: bigint;
  percentageFee: bigint;
  totalRequiredFee: bigint;
  currentReward: bigint;
  minimumRequiredReward: bigint;
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
