import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { IFulfillmentStrategy } from '@/modules/fulfillment/interfaces/fulfillment-strategy.interface';
import {
  QuoteResult,
  ValidationResult,
} from '@/modules/fulfillment/interfaces/quote-result.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { ValidationContextImpl } from '@/modules/fulfillment/validation-context.impl';
import { Validation } from '@/modules/fulfillment/validations';
import { FeeCalculationValidation } from '@/modules/fulfillment/validations/fee-calculation.interface';

@Injectable()
export abstract class FulfillmentStrategy implements IFulfillmentStrategy {
  constructor(
    protected readonly blockchainExecutor: BlockchainExecutorService,
    protected readonly blockchainReader: BlockchainReaderService,
  ) {}

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
    // Create a single immutable context for all validations
    const context = new ValidationContextImpl(
      intent,
      this,
      this.blockchainExecutor,
      this.blockchainReader,
    );

    const validations = this.getValidations();
    for (const validation of validations) {
      const result = await validation.validate(intent, context);
      if (!result) {
        throw new Error(`Validation failed: ${validation.constructor.name}`);
      }
    }
    return true;
  }

  /**
   * IFulfillmentStrategy implementation - Get wallet ID for an intent
   */
  getWalletIdForIntent(_intent: Intent): Promise<WalletType> {
    return Promise.resolve('kernel');
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

  /**
   * Get a quote for fulfilling this intent
   * Runs all validations and extracts fee information
   * @param intent The intent to quote
   * @returns Quote result with validation details and fees
   */
  async getQuote(intent: Intent): Promise<QuoteResult> {
    const context = new ValidationContextImpl(
      intent,
      this,
      this.blockchainExecutor,
      this.blockchainReader,
    );

    const validations = this.getValidations();
    const validationResults: ValidationResult[] = [];
    let valid = true;
    let fees = undefined;

    for (const validation of validations) {
      const validationName = validation.constructor.name;
      try {
        const result = await validation.validate(intent, context);
        if (result) {
          validationResults.push({
            validation: validationName,
            passed: true,
          });

          // Extract fee information from the first fee calculation validation only
          if (!fees && this.isFeeCalculationValidation(validation)) {
            fees = await validation.calculateFee(intent, context);
          }
        } else {
          validationResults.push({
            validation: validationName,
            passed: false,
            error: 'Validation returned false',
          });
          valid = false;
        }
      } catch (error) {
        validationResults.push({
          validation: validationName,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        valid = false;
      }
    }

    return {
      valid,
      strategy: this.name,
      fees,
      validationResults,
    };
  }

  private isFeeCalculationValidation(
    validation: Validation,
  ): validation is FeeCalculationValidation {
    return 'calculateFee' in validation;
  }
}
