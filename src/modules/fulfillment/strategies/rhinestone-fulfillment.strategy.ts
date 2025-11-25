import { Inject, Injectable, Optional } from '@nestjs/common';

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
  ProverSupportValidation,
  RhinestoneValidation,
  RouteAmountLimitValidation,
  RouteEnabledValidation,
  RouteTokenValidation,
  Validation,
} from '@/modules/fulfillment/validations';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';
import { RhinestoneMetadataService } from '@/modules/rhinestone/services/rhinestone-metadata.service';

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class RhinestoneFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.RHINESTONE;
  private readonly validations: ReadonlyArray<Validation>;

  constructor(
    protected readonly blockchainExecutor: BlockchainExecutorService,
    protected readonly blockchainReader: BlockchainReaderService,
    protected readonly otelService: OpenTelemetryService,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    // Inject all validations needed for rhinestone strategy
    // NOTE: IntentFundedValidation is EXCLUDED - Rhinestone solver funds via CLAIM phase
    // NOTE: RouteCallsValidation is EXCLUDED - Smart accounts have custom call patterns
    private readonly duplicateRewardTokensValidation: DuplicateRewardTokensValidation,
    private readonly routeTokenValidation: RouteTokenValidation,
    private readonly routeAmountLimitValidation: RouteAmountLimitValidation,
    private readonly expirationValidation: ExpirationValidation,
    private readonly chainSupportValidation: ChainSupportValidation,
    private readonly routeEnabledValidation: RouteEnabledValidation,
    private readonly proverSupportValidation: ProverSupportValidation,
    private readonly executorBalanceValidation: ExecutorBalanceValidation,
    private readonly rhinestoneValidation: RhinestoneValidation,
    @Optional()
    private readonly metadataService?: RhinestoneMetadataService,
  ) {
    super(blockchainExecutor, blockchainReader, otelService);
    // Define immutable validations for this strategy
    // IntentFundedValidation is EXCLUDED because in Rhinestone's model,
    // the solver (not the user) funds the intent during the CLAIM phase.
    this.validations = Object.freeze([
      this.duplicateRewardTokensValidation,
      this.routeTokenValidation,
      this.routeAmountLimitValidation,
      this.expirationValidation,
      this.chainSupportValidation,
      this.routeEnabledValidation,
      this.proverSupportValidation,
      this.executorBalanceValidation,
      this.rhinestoneValidation,
    ]);
  }

  canHandle(_intent: Intent): boolean {
    return true;
  }

  async execute(intent: Intent): Promise<void> {
    return this.otelService.withSpan('rhinestone-strategy.execute', async (span) => {
      span.setAttributes({
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.sourceChainId.toString(),
        'intent.destination_chain': intent.destination.toString(),
        'intent.calls_count': intent.route.calls.length,
        'intent.tokens_count': intent.route.tokens.length + intent.reward.tokens.length,
        'strategy.name': this.name,
        'strategy.skips_route_calls_validation': true,
      });

      if (!this.metadataService) {
        throw new Error('MetadataService is missing. Rhinestone module may not be enabled.');
      }

      // Retrieve Rhinestone payload from Redis
      const rhinestonePayload = await this.metadataService.get(intent.intentHash);

      if (!rhinestonePayload) {
        throw new Error(
          `No Rhinestone payload found for intent ${intent.intentHash}. ` +
            'Payload must be stored before queueing to FulfillmentQueue.',
        );
      }

      // Get wallet ID for this intent
      const walletId = await this.getWalletIdForIntent(intent);

      span.setAttributes({
        'wallet.id': walletId,
        'rhinestone.payload_verified': true,
      });

      // Queue to ExecutionQueue (payload will be retrieved from Redis during execution)
      await this.queueService.addIntentToExecutionQueue({
        type: 'standard',
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
