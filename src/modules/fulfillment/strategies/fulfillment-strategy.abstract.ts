import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { Validation } from '@/modules/fulfillment/validations';

@Injectable()
export abstract class FulfillmentStrategy {
  /**
   * Strategy name for identification
   */
  abstract readonly name: FulfillmentStrategyName;

  /**
   * Validate the intent using all configured validations
   * @param intent The intent to validate
   * @returns true if all validations pass
   * @throws Error if any validation fails
   */
  async validate(intent: Intent): Promise<boolean> {
    const validations = this.getValidations();
    for (const validation of validations) {
      const result = await validation.validate(intent);
      if (!result) {
        throw new Error(`Validation failed: ${validation.constructor.name}`);
      }
    }
    return true;
  }

  /**
   * Execute the fulfillment for the given intent
   * @param intent The intent to fulfill
   */
  abstract execute(intent: Intent): Promise<void>;

  /**
   * Check if this strategy can handle the given intent
   * @param intent The intent to check
   * @returns true if this strategy can handle the intent
   */
  abstract canHandle(intent: Intent): boolean;

  /**
   * Get the validations for this strategy
   * Each strategy must define its own immutable set of validations
   */
  protected abstract getValidations(): ReadonlyArray<Validation>;
}
