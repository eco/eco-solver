import { Inject, Injectable } from '@nestjs/common';
import { FulfillmentStrategy } from './fulfillment-strategy.abstract';
import { ExecutionService } from '@/modules/execution/execution.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { Intent } from '@/common/interfaces/intent.interface';
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

@Injectable()
export class StandardFulfillmentStrategy extends FulfillmentStrategy {
  readonly name = 'standard';
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    private readonly executionService: ExecutionService,
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

  canHandle(intent: Intent): boolean {
    // Standard strategy handles intents without special metadata
    // This is the default strategy for regular cross-chain intents
    return !intent.metadata?.strategyType || intent.metadata.strategyType === 'standard';
  }

  async execute(intent: Intent): Promise<void> {
    // Standard fulfillment uses appropriate executor based on target chain
    const targetChainId = Number(intent.route.destination);

    // Add to execution queue with standard execution data
    await this.queueService.addJob(
      QueueNames.INTENT_EXECUTION,
      {
        intentId: intent.intentId,
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
