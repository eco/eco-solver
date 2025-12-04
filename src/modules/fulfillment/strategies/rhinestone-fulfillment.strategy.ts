import { Inject, Injectable, Logger } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { AggregatedValidationError } from '@/modules/fulfillment/errors/aggregated-validation.error';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { RhinestoneActionFulfillmentJob } from '@/modules/fulfillment/interfaces/fulfillment-job.interface';
import {
  FULFILLMENT_STRATEGY_NAMES,
  FulfillmentStrategyName,
} from '@/modules/fulfillment/types/strategy-name.type';
import { ValidationContextImpl } from '@/modules/fulfillment/validation-context.impl';
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

import { FulfillmentStrategy } from './fulfillment-strategy.abstract';

@Injectable()
export class RhinestoneFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = FULFILLMENT_STRATEGY_NAMES.RHINESTONE;
  private readonly logger = new Logger(RhinestoneFulfillmentStrategy.name);
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

  async validate(_intent: Intent): Promise<boolean> {
    throw new Error(
      'RhinestoneFulfillmentStrategy.validate() not supported. ' +
        'Use validateAction() for Rhinestone action-based processing.',
    );
  }

  async execute(_intent: Intent): Promise<void> {
    throw new Error(
      'RhinestoneFulfillmentStrategy.execute() not supported. ' +
        'Use executeAction() for Rhinestone action-based processing.',
    );
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }

  /**
   * Validate entire Rhinestone action (all intents together)
   * This is used for action-based processing from the fulfillment queue
   */
  async validateAction(jobData: RhinestoneActionFulfillmentJob): Promise<void> {
    return this.otelService.withSpan('rhinestone.validate-action', async (span) => {
      span.setAttributes({
        'rhinestone.message_id': jobData.messageId,
        'rhinestone.action_id': jobData.actionId,
        'rhinestone.claims_count': jobData.claims.length,
        'rhinestone.intents_count': jobData.fill.intents.length,
      });

      // STEP 1: Payload validations (moved from ActionProcessor)
      for (const claim of jobData.claims) {
        if (claim.metadata) {
          // Validate settlement layer
          if (claim.metadata.settlementLayer !== 'ECO') {
            throw new ValidationError(
              `Unsupported settlement layer: ${claim.metadata.settlementLayer}`,
              ValidationErrorType.PERMANENT,
              'RhinestoneFulfillmentStrategy.validateAction',
            );
          }
        }
      }

      // STEP 2: Intent validations (for ALL intents)
      const allIntents = jobData.claims.map((c) => c.intent);
      const validations = this.getValidations();

      this.logger.log(
        `Validating ${allIntents.length} intents with ${validations.length} validations each ` +
          `(total: ${allIntents.length * validations.length} validation checks)`,
      );

      // Create validation contexts and run all validations
      const validationPromises = allIntents.flatMap((intent) => {
        const context = new ValidationContextImpl(
          intent,
          this,
          this.blockchainExecutor,
          this.blockchainReader,
        );
        return validations.map((validation) => validation.validate(intent, context));
      });

      const results = await Promise.allSettled(validationPromises);

      // Collect errors
      const failures = results
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason as Error);

      if (failures.length > 0) {
        this.logger.error(
          `Action validation failed: ${failures.length} validation(s) failed across ${allIntents.length} intents`,
        );
        throw new AggregatedValidationError(failures);
      }

      this.logger.log(`All validations passed for action ${jobData.actionId}`);
    });
  }

  /**
   * Execute Rhinestone action (queue to FlowProducer)
   * This is used for action-based processing from the fulfillment queue
   */
  async executeAction(jobData: RhinestoneActionFulfillmentJob): Promise<void> {
    return this.otelService.withSpan('rhinestone.execute-action', async (span) => {
      span.setAttributes({
        'rhinestone.message_id': jobData.messageId,
        'rhinestone.action_id': jobData.actionId,
      });

      // Queue to FlowProducer (existing logic in QueueService)
      await this.queueService.addRhinestoneMulticlaimFlow({
        messageId: jobData.messageId,
        actionId: jobData.actionId,
        claims: jobData.claims.map((c) => ({
          intentHash: c.intentHash,
          chainId: c.chainId,
          transaction: c.transaction,
        })),
        fill: jobData.fill,
        walletId: jobData.walletId,
      });

      span.addEvent('action-queued-to-flowproducer', {
        claims: jobData.claims.length,
      });
    });
  }
}
