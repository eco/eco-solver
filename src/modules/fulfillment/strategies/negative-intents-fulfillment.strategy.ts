import { Inject, Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import {
  ChainSupportValidation,
  DuplicateRewardTokensValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  IntentFundedValidation,
  NativeFeeValidation,
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteTokenValidation,
  Validation,
} from '@/modules/fulfillment/validations';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class NegativeIntentsFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    protected readonly blockchainExecutor: BlockchainExecutorService,
    protected readonly blockchainReader: BlockchainReaderService,
    protected readonly otelService: OpenTelemetryService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for negative intents strategy
    private readonly intentFundedValidation: IntentFundedValidation,
    private readonly duplicateRewardTokensValidation: DuplicateRewardTokensValidation,
    private readonly routeTokenValidation: RouteTokenValidation,
    private readonly routeCallsValidation: RouteCallsValidation,
    private readonly routeAmountLimitValidation: RouteAmountLimitValidation,
    private readonly expirationValidation: ExpirationValidation,
    private readonly chainSupportValidation: ChainSupportValidation,
    private readonly proverSupportValidation: ProverSupportValidation,
    private readonly executorBalanceValidation: ExecutorBalanceValidation,
    private readonly nativeFeeValidation: NativeFeeValidation,
  ) {
    super(blockchainExecutor, blockchainReader, otelService);
    // Define immutable validations for this strategy
    this.validations = Object.freeze([
      this.intentFundedValidation,
      this.duplicateRewardTokensValidation,
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
    const span = this.otelService.startSpan('negative-intents-strategy.execute', {
      attributes: {
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.route.source.toString(),
        'intent.destination_chain': intent.route.destination.toString(),
        'intent.native_value': intent.reward.nativeValue.toString(),
        'intent.tokens_count': intent.route.tokens.length + intent.reward.tokens.length,
        'strategy.name': this.name,
      },
    });

    try {
      // Get wallet ID for this intent
      const walletId = await this.getWalletIdForIntent(intent);

      span.setAttributes({
        'wallet.id': walletId,
      });

      // Negative intents fulfillment uses both EVM and SVM executors
      await this.queueService.addIntentToExecutionQueue({
        strategy: this.name,
        intent,
        chainId: intent.route.destination,
        walletId,
      });

      span.addEvent('intent-queued', {
        queue: 'execution',
        strategy: this.name,
      });

      span.setStatus({ code: 1 }); // Success
    } catch (error) {
      span.setStatus({
        code: 2, // Error
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }
}
