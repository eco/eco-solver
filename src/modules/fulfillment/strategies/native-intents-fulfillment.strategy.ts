import { Inject, Injectable } from '@nestjs/common';

import { BlockchainService } from '@/modules/blockchain/blockchain.service';
import { Intent } from '@/common/interfaces/intent.interface';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { ChainSupportValidation } from '../validations/chain-support.validation';
import { ExecutorBalanceValidation } from '../validations/executor-balance.validation';
import { ExpirationValidation } from '../validations/expiration.validation';
import { FundingValidation } from '../validations/funding.validation';
import { NativeFeeValidation } from '../validations/native-fee.validation';
import { ProverSupportValidation } from '../validations/prover-support.validation';
import { RouteAmountLimitValidation } from '../validations/route-amount-limit.validation';
import { RouteCallsValidation } from '../validations/route-calls.validation';
import { RouteTokenValidation } from '../validations/route-token.validation';
import { Validation } from '../validations/validation.interface';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class NativeIntentsFulfillmentStrategy extends FulfillmentStrategy {
  readonly name = 'native-intents';
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for native intents strategy
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
      this.nativeFeeValidation, // Use native-specific fee validation
    ]);
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }

  canHandle(intent: Intent): boolean {
    // Native intents strategy handles intents that use native tokens (ETH, SOL, etc.)
    return (
      intent.metadata?.strategyType === 'native-intents' || intent.metadata?.isNativeToken === true
    );
  }

  async execute(intent: Intent): Promise<void> {
    // Native intents fulfillment uses EVM executor for native token handling
    const targetChainId = Number(intent.route.destination);

    // Add to execution queue with native-specific execution data
    await this.queueService.addJob(
      QueueNames.INTENT_EXECUTION,
      {
        intentId: intent.intentId,
        strategy: this.name,
        targetChainId,
        executorType: 'evm', // Native intents use EVM executor
        executionData: {
          type: 'native-intents',
          amount: intent.reward.nativeValue,
          reward: intent.reward.nativeValue,
          deadline: intent.reward.deadline,
          isNativeToken: true,
          // TODO: Add native token specific parameters
          // nativeTokenSymbol: intent.metadata?.nativeTokenSymbol,
          // gasLimit: intent.metadata?.gasLimit,
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
