import { Inject, Injectable } from '@nestjs/common';

import { SpanStatusCode } from '@opentelemetry/api';

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
  RouteCallsValidation,
  RouteEnabledValidation,
  RouteTokenValidation,
  StandardFeeValidation,
  Validation,
} from '@/modules/fulfillment/validations';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class StandardFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.STANDARD;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    protected readonly blockchainExecutor: BlockchainExecutorService,
    protected readonly blockchainReader: BlockchainReaderService,
    protected readonly otelService: OpenTelemetryService,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    // Inject all validations needed for a standard strategy
    private readonly intentFundedValidation: IntentFundedValidation,
    private readonly duplicateRewardTokensValidation: DuplicateRewardTokensValidation,
    private readonly routeTokenValidation: RouteTokenValidation,
    private readonly routeCallsValidation: RouteCallsValidation,
    private readonly routeAmountLimitValidation: RouteAmountLimitValidation,
    private readonly expirationValidation: ExpirationValidation,
    private readonly chainSupportValidation: ChainSupportValidation,
    private readonly routeEnabledValidation: RouteEnabledValidation,
    private readonly proverSupportValidation: ProverSupportValidation,
    private readonly executorBalanceValidation: ExecutorBalanceValidation,
    private readonly standardFeeValidation: StandardFeeValidation,
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
      this.routeEnabledValidation,
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
    return this.otelService.tracer.startActiveSpan(
      `strategy.${this.name}.execute`,
      {
        attributes: {
          'strategy.name': this.name,
          'intent.hash': intent.intentHash,
          'intent.destination_chain': intent.destination.toString(),
        },
      },
      async (span) => {
        // Get wallet ID for this intent
        const walletId = await this.getWalletIdForIntent(intent);
        span.setAttribute('intent.wallet_type', walletId);

        // Add to execution queue with standard execution data
        await this.queueService.addIntentToExecutionQueue({
          type: 'standard',
          strategy: this.name,
          intent,
          chainId: intent.destination,
          walletId,
        });

        span.addEvent('intent.queued_for_execution');
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      },
    );
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }
}
