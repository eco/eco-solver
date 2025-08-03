import { Inject, Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainService } from '@/modules/blockchain/blockchain.service';
import {
  ChainSupportValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  FundingValidation,
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteTokenValidation,
  StandardFeeValidation,
  Validation,
} from '@/modules/fulfillment/validations';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class RhinestoneFulfillmentStrategy extends FulfillmentStrategy {
  readonly name = 'rhinestone';
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for rhinestone strategy (excluding route calls)
    private readonly fundingValidation: FundingValidation,
    private readonly routeTokenValidation: RouteTokenValidation,
    // Note: RouteCallsValidation is intentionally excluded
    private readonly routeAmountLimitValidation: RouteAmountLimitValidation,
    private readonly expirationValidation: ExpirationValidation,
    private readonly chainSupportValidation: ChainSupportValidation,
    private readonly proverSupportValidation: ProverSupportValidation,
    private readonly executorBalanceValidation: ExecutorBalanceValidation,
    private readonly standardFeeValidation: StandardFeeValidation,
  ) {
    super();
    // Define immutable validations for this strategy (skips route calls validation)
    this.validations = Object.freeze([
      this.fundingValidation,
      this.routeTokenValidation,
      // RouteCallsValidation is intentionally skipped for Rhinestone
      this.routeAmountLimitValidation,
      this.expirationValidation,
      this.chainSupportValidation,
      this.proverSupportValidation,
      this.executorBalanceValidation,
      this.standardFeeValidation,
    ]);
  }

  canHandle(intent: Intent): boolean {
    // Rhinestone strategy for smart account abstraction
    // Currently requires explicit configuration
    // In the future, could detect smart account requirements from:
    // - Specific call patterns that require account abstraction
    // - Target addresses that are known smart accounts
    return false; // Only enabled via configuration
  }

  async execute(intent: Intent): Promise<void> {
    // Rhinestone fulfillment uses only EVM executor with custom execution flow
    const targetChainId = Number(intent.route.destination);

    // Add to execution queue with Rhinestone-specific execution data
    await this.queueService.addJob(
      QueueNames.INTENT_EXECUTION,
      {
        intentId: intent.intentId,
        strategy: this.name,
        targetChainId,
        executorType: 'evm', // Rhinestone only uses EVM executor
        executionData: {
          type: 'rhinestone',
          amount: intent.reward.nativeValue,
          reward: intent.reward,
          deadline: intent.reward.deadline,
          useSmartAccount: true,
        },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }
}
