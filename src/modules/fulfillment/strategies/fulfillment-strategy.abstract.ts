import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { IFulfillmentStrategy } from '@/modules/fulfillment/interfaces/fulfillment-strategy.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { Validation } from '@/modules/fulfillment/validations';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { ValidationContextImpl } from '@/modules/fulfillment/validation-context.impl';

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
}
