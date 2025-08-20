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
  CrowdLiquidityFeeValidation,
  DuplicateRewardTokensValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  IntentFundedValidation,
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
export class CrowdLiquidityFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    protected readonly blockchainExecutor: BlockchainExecutorService,
    protected readonly blockchainReader: BlockchainReaderService,
    protected readonly otelService: OpenTelemetryService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for crowd liquidity strategy
    private readonly intentFundedValidation: IntentFundedValidation,
    private readonly duplicateRewardTokensValidation: DuplicateRewardTokensValidation,
    private readonly routeTokenValidation: RouteTokenValidation,
    private readonly routeCallsValidation: RouteCallsValidation,
    private readonly routeAmountLimitValidation: RouteAmountLimitValidation,
    private readonly expirationValidation: ExpirationValidation,
    private readonly chainSupportValidation: ChainSupportValidation,
    private readonly proverSupportValidation: ProverSupportValidation,
    private readonly executorBalanceValidation: ExecutorBalanceValidation,
    private readonly crowdLiquidityFeeValidation: CrowdLiquidityFeeValidation,
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
      this.crowdLiquidityFeeValidation, // Use CL-specific fee validation
    ]);
  }

  canHandle(_intent: Intent): boolean {
    // Crowd liquidity strategy currently requires explicit configuration
    // In the future, could analyze intent properties like:
    // - Large token amounts that might benefit from liquidity pools
    // - Cross-chain routes that have known liquidity constraints
    return false; // Only enabled via configuration
  }

  async execute(intent: Intent): Promise<void> {
    const span = this.otelService.startSpan(`strategy.${this.name}.execute`, {
      attributes: {
        'strategy.name': this.name,
        'intent.hash': intent.intentHash,
        'intent.destination_chain': intent.route.destination.toString(),
      },
    });

    try {
      // Get wallet ID for this intent
      const walletId = await this.getWalletIdForIntent(intent);
      span.setAttribute('intent.wallet_type', walletId);

      // Crowd liquidity fulfillment only uses the CL executor
      await this.queueService.addIntentToExecutionQueue({
        strategy: this.name,
        intent,
        chainId: intent.route.destination,
        walletId,
      });

      span.addEvent('intent.queued_for_execution');
      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2 }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }
}
