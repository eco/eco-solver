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
  NativeFeeValidation,
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteTokenValidation,
  Validation,
} from '@/modules/fulfillment/validations';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class NegativeIntentsFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for negative intents strategy
    private readonly fundingValidation: FundingValidation,
    private readonly routeTokenValidation: RouteTokenValidation,
    private readonly routeCallsValidation: RouteCallsValidation,
    private readonly routeAmountLimitValidation: RouteAmountLimitValidation,
    private readonly expirationValidation: ExpirationValidation,
    private readonly chainSupportValidation: ChainSupportValidation,
    private readonly proverSupportValidation: ProverSupportValidation,
    private readonly executorBalanceValidation: ExecutorBalanceValidation,
    private readonly nativeFeeValidation: NativeFeeValidation,
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
      this.nativeFeeValidation, // Use native fee validation for negative intents
    ]);
  }

  canHandle(_intent: Intent): boolean {
    // Negative intents strategy for debt or negative balance scenarios
    // Currently requires explicit configuration
    // In the future, could detect negative intent patterns from:
    // - Specific protocol interactions that represent debt
    // - Call data patterns that indicate borrowing/lending
    return false; // Only enabled via configuration
  }

  async execute(intent: Intent): Promise<void> {
    // Negative intents fulfillment uses both EVM and SVM executors
    const targetChainId = Number(intent.route.destination);

    // Determine which executor to use based on chain type
    const isEvmChain = this.isEvmChain(targetChainId);
    const executorType = isEvmChain ? 'evm' : 'svm';

    // Add to execution queue with negative-intents-specific execution data
    await this.queueService.addJob(
      QueueNames.INTENT_EXECUTION,
      {
        intentId: intent.intentHash,
        strategy: this.name,
        targetChainId,
        executorType, // Can be either EVM or SVM
        executionData: {
          type: 'negative-intents',
          amount: intent.reward.nativeValue,
          reward: intent.reward,
          deadline: intent.reward.deadline,
          isNegativeIntent: true,
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

  private isEvmChain(chainId: number): boolean {
    // TODO: Get this from configuration
    const evmChains = [1, 10, 137, 42161, 8453]; // Mainnet, Optimism, Polygon, Arbitrum, Base
    return evmChains.includes(chainId);
  }
}
