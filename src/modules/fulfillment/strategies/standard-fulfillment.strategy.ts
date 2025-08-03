import { Inject, Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainService } from '@/modules/blockchain/blockchain.service';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import {
  ChainSupportValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  FundingValidation,
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteTokenValidation,
  StandardFeeValidation,
  Validation,
} from '@/modules/fulfillment/validations';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class StandardFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.STANDARD;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for standard strategy
    private readonly fundingValidation: FundingValidation,
    private readonly routeTokenValidation: RouteTokenValidation,
    private readonly routeCallsValidation: RouteCallsValidation,
    private readonly routeAmountLimitValidation: RouteAmountLimitValidation,
    private readonly expirationValidation: ExpirationValidation,
    private readonly chainSupportValidation: ChainSupportValidation,
    private readonly proverSupportValidation: ProverSupportValidation,
    private readonly executorBalanceValidation: ExecutorBalanceValidation,
    private readonly standardFeeValidation: StandardFeeValidation,
  ) {
    super();
    // Define immutable validations for this strategy
    this.validations = Object.freeze([
      this.fundingValidation,
      this.routeTokenValidation,
      this.routeCallsValidation,
      this.routeAmountLimitValidation,
      this.expirationValidation,
      this.chainSupportValidation,
      this.proverSupportValidation,
      this.executorBalanceValidation,
      this.standardFeeValidation,
    ]);
  }

  canHandle(_intent: Intent): boolean {
    // Standard strategy is the default and can handle all intents
    // Other strategies should be more specific in their canHandle logic
    return true;
  }

  async execute(intent: Intent): Promise<void> {
    // Standard fulfillment uses appropriate executor based on target chain
    const targetChainId = Number(intent.route.destination);

    // Add to execution queue with standard execution data
    await this.queueService.addJob(
      QueueNames.INTENT_EXECUTION,
      {
        intentId: intent.intentHash,
        strategy: this.name,
        targetChainId,
        executionData: {
          // TODO: Add specific execution data based on intent requirements
          type: 'standard',
          amount: intent.reward.nativeValue,
          reward: intent.reward,
          deadline: intent.reward.deadline,
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
