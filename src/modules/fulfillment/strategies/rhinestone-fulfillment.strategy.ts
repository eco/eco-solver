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
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteTokenValidation,
  StandardFeeValidation,
  Validation,
} from '@/modules/fulfillment/validations';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class RhinestoneFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.RHINESTONE;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    protected readonly blockchainExecutor: BlockchainExecutorService,
    protected readonly blockchainReader: BlockchainReaderService,
    protected readonly otelService: OpenTelemetryService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for rhinestone strategy (excluding route calls)
    private readonly intentFundedValidation: IntentFundedValidation,
    private readonly duplicateRewardTokensValidation: DuplicateRewardTokensValidation,
    private readonly routeTokenValidation: RouteTokenValidation,
    // Note: RouteCallsValidation is intentionally excluded
    private readonly routeAmountLimitValidation: RouteAmountLimitValidation,
    private readonly expirationValidation: ExpirationValidation,
    private readonly chainSupportValidation: ChainSupportValidation,
    private readonly proverSupportValidation: ProverSupportValidation,
    private readonly executorBalanceValidation: ExecutorBalanceValidation,
    private readonly standardFeeValidation: StandardFeeValidation,
  ) {
    super(blockchainExecutor, blockchainReader, otelService);
    // Define immutable validations for this strategy (skips route calls validation)
    this.validations = Object.freeze([
      this.intentFundedValidation,
      this.duplicateRewardTokensValidation,
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

  canHandle(_intent: Intent): boolean {
    // Rhinestone strategy for smart account abstraction
    // Currently requires explicit configuration
    // In the future, could detect smart account requirements from:
    // - Specific call patterns that require account abstraction
    // - Target addresses that are known smart accounts
    return false; // Only enabled via configuration
  }

  async execute(intent: Intent): Promise<void> {
    const span = this.otelService.startSpan('rhinestone-strategy.execute', {
      attributes: {
        'intent.id': intent.intentHash,
        'intent.source_chain': intent.route.source.toString(),
        'intent.destination_chain': intent.route.destination.toString(),
        'intent.calls_count': intent.route.calls.length,
        'intent.tokens_count': intent.route.tokens.length + intent.reward.tokens.length,
        'strategy.name': this.name,
        'strategy.skips_route_calls_validation': true,
      },
    });

    try {
      // Get wallet ID for this intent
      const walletId = await this.getWalletIdForIntent(intent);

      span.setAttributes({
        'wallet.id': walletId,
      });

      // Rhinestone fulfillment uses only EVM executor with custom execution flow
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
