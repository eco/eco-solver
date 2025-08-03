import { Inject, Injectable } from '@nestjs/common';
import { FulfillmentStrategy } from './fulfillment-strategy.abstract';
import { ExecutionService } from '@/modules/execution/execution.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
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
import { Intent } from '@/common/interfaces/intent.interface';

@Injectable()
export class RhinestoneFulfillmentStrategy extends FulfillmentStrategy {
  readonly name = 'rhinestone';
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    private readonly executionService: ExecutionService,
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
    // Rhinestone strategy handles intents for smart account abstraction
    return (
      intent.metadata?.strategyType === 'rhinestone' || intent.metadata?.useSmartAccount === true
    );
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
          // TODO: Add Rhinestone-specific parameters
          // smartAccountAddress: intent.metadata?.smartAccountAddress,
          // moduleAddress: intent.metadata?.moduleAddress,
          // userOperation: intent.metadata?.userOperation,
          // paymasterData: intent.metadata?.paymasterData,
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
