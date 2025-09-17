import { Inject, Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

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
  RouteEnabledValidation,
  RouteTokenValidation,
  Validation,
} from '../validations';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class NativeIntentsFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.NATIVE_INTENTS;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    protected readonly blockchainExecutor: BlockchainExecutorService,
    protected readonly blockchainReader: BlockchainReaderService,
    protected readonly otelService: OpenTelemetryService,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    // Inject all validations needed for native intents strategy
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
      this.routeEnabledValidation,
      this.proverSupportValidation,
      this.executorBalanceValidation,
      this.nativeFeeValidation, // Use native-specific fee validation
    ]);
  }

  canHandle(intent: Intent): boolean {
    // Native intents strategy handles intents that only involve native tokens
    // Check if the intent has no token transfers, only native value
    const hasTokenTransfers = intent.route.tokens.length > 0 || intent.reward.tokens.length > 0;
    const hasnativeAmount = intent.reward.nativeAmount > 0n;

    return !hasTokenTransfers && hasnativeAmount;
  }

  async execute(intent: Intent): Promise<void> {
    return this.otelService.withSpan('native-intents-strategy.execute', async (span) => {
      span.setAttributes({
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.sourceChainId.toString(),
        'intent.destination_chain': intent.destination.toString(),
        'intent.native_value': intent.reward.nativeAmount.toString(),
        'intent.has_tokens': false,
        'strategy.name': this.name,
      });

      // Get wallet ID for this intent
      const walletId = await this.getWalletIdForIntent(intent);

      span.setAttributes({
        'wallet.id': walletId,
      });

      // Native intents fulfillment uses EVM executor for native token handling
      await this.queueService.addIntentToExecutionQueue({
        strategy: this.name,
        intent,
        chainId: intent.destination,
        walletId,
      });

      span.addEvent('intent-queued', {
        queue: 'execution',
        strategy: this.name,
      });
    });
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }
}
