import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { AggregatedValidationError } from '@/modules/fulfillment/errors/aggregated-validation.error';
import { IFulfillmentStrategy } from '@/modules/fulfillment/interfaces/fulfillment-strategy.interface';
import {
  QuoteResult,
  ValidationResult,
} from '@/modules/fulfillment/interfaces/quote-result.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { ValidationContextImpl } from '@/modules/fulfillment/validation-context.impl';
import { Validation } from '@/modules/fulfillment/validations';
import {
  FeeCalculationValidation,
  FeeDetails,
} from '@/modules/fulfillment/validations/fee-calculation.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

@Injectable()
export abstract class FulfillmentStrategy implements IFulfillmentStrategy {
  constructor(
    protected readonly blockchainExecutor: BlockchainExecutorService,
    protected readonly blockchainReader: BlockchainReaderService,
    protected readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * Strategy name for identification
   */
  abstract readonly name: FulfillmentStrategyName;

  /**
   * Validate the intent using all configured validations
   * @param intent The intent to validate
   * @returns true if all validations pass
   * @throws Error if any validation fails
   */
  async validate(intent: Intent): Promise<boolean> {
    const span = this.otelService.startSpan(`strategy.${this.name}.validate`, {
      attributes: {
        'strategy.name': this.name,
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.sourceChainId?.toString() || 'unknown',
        'intent.destination_chain': intent.destination.toString(),
      },
    });

    try {
      // Create a single immutable context for all validations
      const context = new ValidationContextImpl(
        intent,
        this,
        this.blockchainExecutor,
        this.blockchainReader,
      );

      const validations = this.getValidations();
      span.setAttribute('strategy.validation_count', validations.length);

      // Execute all validations in parallel
      const validationPromises = validations.map(async (validation) => {
        const validationName = validation.constructor.name;
        const validationSpan = this.otelService.startSpan(`validation.${validationName}`, {
          attributes: {
            'validation.name': validationName,
            'intent.hash': intent.intentHash,
          },
        });

        try {
          const result = await api.context.with(
            api.trace.setSpan(api.context.active(), validationSpan),
            () => validation.validate(intent, context),
          );

          if (!result) {
            validationSpan.setStatus({
              code: api.SpanStatusCode.ERROR,
              message: 'Validation returned false',
            });
            validationSpan.end();
            return {
              status: 'rejected' as const,
              reason: new Error(`Validation failed: ${validationName}`),
            };
          }

          validationSpan.setStatus({ code: api.SpanStatusCode.OK });
          validationSpan.end();
          return { status: 'fulfilled' as const, value: true };
        } catch (error) {
          validationSpan.recordException(toError(error));
          validationSpan.setStatus({ code: api.SpanStatusCode.ERROR });
          validationSpan.end();
          return {
            status: 'rejected' as const,
            reason: toError(error),
          };
        }
      });

      // Wait for all validations to complete
      const results = await Promise.allSettled(validationPromises);

      // Collect all failures
      const failures = results
        .filter((result) => result.status === 'fulfilled' && result.value.status === 'rejected')
        .map((result) => (result as PromiseFulfilledResult<any>).value.reason);

      // If any validation failed, throw an aggregated error that preserves error types
      if (failures.length > 0) {
        // If there's only one failure and it's already a ValidationError, throw it directly
        if (failures.length === 1) {
          const singleError = failures[0];
          span.recordException(singleError);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw singleError;
        }

        // Multiple failures - create an aggregated error that preserves types
        const aggregatedError = new AggregatedValidationError(failures);
        span.recordException(aggregatedError);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
        throw aggregatedError;
      }

      span.setStatus({ code: api.SpanStatusCode.OK });
      return true;
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * IFulfillmentStrategy implementation - Get wallet ID for an intent
   * Returns blockchain-specific default wallet types
   */
  getWalletIdForIntent(intent: Intent): Promise<WalletType> {
    // Determine wallet type based on destination blockchain
    const chainType = ChainTypeDetector.detect(intent.destination);

    // TVM and SVM only support basic wallets
    // EVM can use kernel wallets for advanced features
    const walletType: WalletType = chainType === ChainType.EVM ? 'kernel' : 'basic';

    return Promise.resolve(walletType);
  }

  /**
   * Execute the fulfillment for the given intent
   * @param intent The intent to fulfill
   */
  abstract execute(intent: Intent): Promise<void>;

  /**
   * Check if this strategy can handle the given intent
   * @param intent The intent to check
   * @returns true if this strategy can handle the intent
   */
  abstract canHandle(intent: Intent): boolean;

  /**
   * Get the validations for this strategy
   * Each strategy must define its own immutable set of validations
   */
  protected abstract getValidations(): ReadonlyArray<Validation>;

  /**
   * Get a quote for fulfilling this intent
   * Runs all validations and extracts fee information
   * @param intent The intent to quote
   * @returns Quote result with validation details and fees
   */
  async getQuote(intent: Intent): Promise<QuoteResult> {
    const span = this.otelService.startSpan(`strategy.${this.name}.getQuote`, {
      attributes: {
        'strategy.name': this.name,
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.sourceChainId?.toString() || 'unknown',
        'intent.destination_chain': intent.destination.toString(),
      },
    });

    try {
      const context = new ValidationContextImpl(
        intent,
        this,
        this.blockchainExecutor,
        this.blockchainReader,
      );

      const validations = this.getValidations();
      span.setAttribute('strategy.validation_count', validations.length);

      // Define type for intermediate validation results
      interface ValidationResultWithFee extends ValidationResult {
        fee?: FeeDetails;
      }

      // Execute all validations and fee calculations in parallel
      const validationPromises = validations.map(
        async (validation): Promise<ValidationResultWithFee> => {
          const validationName = validation.constructor.name;
          const validationSpan = this.otelService.startSpan(`quote.validation.${validationName}`, {
            attributes: {
              'validation.name': validationName,
              'intent.hash': intent.intentHash,
            },
          });

          try {
            const result = await api.context.with(
              api.trace.setSpan(api.context.active(), span),
              async () => {
                return await validation.validate(intent, context);
              },
            );

            let feeResult = undefined;

            if (result) {
              // Calculate fee if this is a fee calculation validation
              if (this.isFeeCalculationValidation(validation)) {
                const feeSpan = this.otelService.startSpan(`quote.calculateFee.${validationName}`);
                try {
                  feeResult = await api.context.with(
                    api.trace.setSpan(api.context.active(), span),
                    async () => {
                      return await validation.calculateFee(intent, context);
                    },
                  );
                  if (feeResult) {
                    feeSpan.setAttributes({
                      'fee.base': feeResult.baseFee.toString(),
                      'fee.percentage': feeResult.percentageFee.toString(),
                      'fee.total': feeResult.totalRequiredFee.toString(),
                    });
                  }
                  feeSpan.setStatus({ code: api.SpanStatusCode.OK });
                } catch (error) {
                  feeSpan.recordException(toError(error));
                  feeSpan.setStatus({ code: api.SpanStatusCode.ERROR });
                  throw error;
                } finally {
                  feeSpan.end();
                }
              }

              validationSpan.setAttribute('validation.passed', true);
              validationSpan.setStatus({ code: api.SpanStatusCode.OK });
              return {
                validation: validationName,
                passed: true,
                fee: feeResult,
              };
            } else {
              validationSpan.setAttribute('validation.passed', false);
              validationSpan.setStatus({
                code: api.SpanStatusCode.ERROR,
                message: 'Validation returned false',
              });
              return {
                validation: validationName,
                passed: false,
                error: 'Validation returned false',
              };
            }
          } catch (error) {
            validationSpan.recordException(toError(error));
            validationSpan.setAttribute('validation.passed', false);
            validationSpan.setStatus({ code: api.SpanStatusCode.ERROR });
            return {
              validation: validationName,
              passed: false,
              error: getErrorMessage(error),
            };
          } finally {
            validationSpan.end();
          }
        },
      );

      // Wait for all validations to complete
      const results = await Promise.all(validationPromises);

      // Process results
      const validationResults: ValidationResult[] = results.map((result) => ({
        validation: result.validation,
        passed: result.passed,
        error: result.error,
      }));

      const valid = results.every((result) => result.passed);

      // Extract the first fee result from fee calculation validations
      const fees = results.find((result: ValidationResultWithFee) => result.fee)?.fee;

      span.setAttributes({
        'quote.valid': valid,
        'quote.has_fees': !!fees,
      });
      span.setStatus({ code: api.SpanStatusCode.OK });

      return {
        valid,
        strategy: this.name,
        fees,
        validationResults,
      };
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  private isFeeCalculationValidation(
    validation: Validation,
  ): validation is FeeCalculationValidation {
    return 'calculateFee' in validation;
  }
}
