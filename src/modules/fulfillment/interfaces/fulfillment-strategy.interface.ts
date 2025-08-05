import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

export interface IFulfillmentStrategy {
  name: FulfillmentStrategyName;

  /**
   * Validate the intent using all configured validations
   * @param intent The intent to validate
   * @returns true if all validations pass
   * @throws Error if any validation fails
   */
  validate(intent: Intent): Promise<boolean>;

  /**
   * Execute the fulfillment for the given intent
   * @param intent The intent to fulfill
   */
  execute(intent: Intent): Promise<void>;

  /**
   * Check if this strategy can handle the given intent
   * @param intent The intent to check
   * @returns true if this strategy can handle the intent
   */
  canHandle(intent: Intent): boolean;

  /**
   * Retrieves the wallet ID associated with the provided intent.
   *
   * @param {Intent} intent - The intent object containing details used to obtain the wallet ID.
   * @return {Promise<string>} A promise that resolves to the wallet ID as a string.
   */
  getWalletIdForIntent(intent: Intent): Promise<string>;
}
