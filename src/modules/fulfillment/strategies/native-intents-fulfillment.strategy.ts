import { Inject, Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { ChainSupportValidation } from '../validations/chain-support.validation';
import { ExecutorBalanceValidation } from '../validations/executor-balance.validation';
import { ExpirationValidation } from '../validations/expiration.validation';
import { FundingValidation } from '../validations/funding.validation';
import { IntentFundedValidation } from '../validations/intent-funded.validation';
import { NativeFeeValidation } from '../validations/native-fee.validation';
import { ProverSupportValidation } from '../validations/prover-support.validation';
import { RouteAmountLimitValidation } from '../validations/route-amount-limit.validation';
import { RouteCallsValidation } from '../validations/route-calls.validation';
import { RouteTokenValidation } from '../validations/route-token.validation';
import { Validation } from '../validations/validation.interface';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class NativeIntentsFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.NATIVE_INTENTS;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    private readonly blockchainService: BlockchainExecutorService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for native intents strategy
    private readonly fundingValidation: FundingValidation,
    private readonly intentFundedValidation: IntentFundedValidation,
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
      this.intentFundedValidation,
      this.routeTokenValidation,
      this.routeCallsValidation,
      this.routeAmountLimitValidation,
      this.expirationValidation,
      this.chainSupportValidation,
      this.proverSupportValidation,
      this.executorBalanceValidation,
      this.nativeFeeValidation, // Use native-specific fee validation
    ]);
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }

  canHandle(intent: Intent): boolean {
    // Native intents strategy handles intents that only involve native tokens
    // Check if the intent has no token transfers, only native value
    const hasTokenTransfers = intent.route.tokens.length > 0 || intent.reward.tokens.length > 0;
    const hasNativeValue = intent.reward.nativeValue > 0n;

    return !hasTokenTransfers && hasNativeValue;
  }

  async execute(intent: Intent): Promise<void> {
    // Native intents fulfillment uses EVM executor for native token handling
    const targetChainId = Number(intent.route.destination);

    // Add to execution queue with native-specific execution data
    await this.queueService.addJob(
      QueueNames.INTENT_EXECUTION,
      {
        intentId: intent.intentHash,
        strategy: this.name,
        targetChainId,
        executorType: 'evm', // Native intents use EVM executor
        executionData: {
          type: 'native-intents',
          amount: intent.reward.nativeValue,
          reward: intent.reward.nativeValue,
          deadline: intent.reward.deadline,
          isNativeToken: true,
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
}
