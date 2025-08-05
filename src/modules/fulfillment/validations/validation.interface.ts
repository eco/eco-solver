import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentStrategy } from '@/modules/fulfillment/strategies';

export interface Validation {
  /**
   * Validate the intent
   * @param intent The intent to validate
   * @param fulfillmentStrategy The fulfillment strategy
   * @returns true if validation passes, false otherwise
   * @throws Error with specific validation failure reason
   */
  validate(intent: Intent, fulfillmentStrategy: FulfillmentStrategy): Promise<boolean>;
}
