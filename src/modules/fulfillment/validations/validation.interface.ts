import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

export interface Validation {
  /**
   * Validate the intent
   * @param intent The intent to validate
   * @param context The validation context providing necessary blockchain information
   * @returns true if validation passes, false otherwise
   * @throws Error with specific validation failure reason
   */
  validate(intent: Intent, context: ValidationContext): Promise<boolean>;
}
