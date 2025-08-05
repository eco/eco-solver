import { Inject, Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import {
  ChainSupportValidation,
  CrowdLiquidityFeeValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  IntentFundedValidation,
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteTokenValidation,
  Validation,
} from '@/modules/fulfillment/validations';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class CrowdLiquidityFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    private readonly blockchainService: BlockchainExecutorService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for crowd liquidity strategy
    private readonly intentFundedValidation: IntentFundedValidation,
    private readonly routeTokenValidation: RouteTokenValidation,
    private readonly routeCallsValidation: RouteCallsValidation,
    private readonly routeAmountLimitValidation: RouteAmountLimitValidation,
    private readonly expirationValidation: ExpirationValidation,
    private readonly chainSupportValidation: ChainSupportValidation,
    private readonly proverSupportValidation: ProverSupportValidation,
    private readonly executorBalanceValidation: ExecutorBalanceValidation,
    private readonly crowdLiquidityFeeValidation: CrowdLiquidityFeeValidation,
  ) {
    super();
    // Define immutable validations for this strategy
    this.validations = Object.freeze([
      this.intentFundedValidation,
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
    // Crowd liquidity fulfillment only uses the CL executor
    await this.queueService.addIntentToExecutionQueue({
      strategy: this.name,
      intent,
      chainId: intent.route.destination,
    });
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }
}
