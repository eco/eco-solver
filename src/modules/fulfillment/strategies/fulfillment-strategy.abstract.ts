import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
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
        'intent.id': intent.intentHash,
        'intent.source_chain': intent.route.source.toString(),
        'intent.destination_chain': intent.route.destination.toString(),
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
            'intent.id': intent.intentHash,
          },
        });

        try {
          const result = await api.context.with(
            api.trace.setSpan(api.context.active(), span),
            async () => {
              return await validation.validate(intent, context);
            },
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
          validationSpan.recordException(error as Error);
          validationSpan.setStatus({ code: api.SpanStatusCode.ERROR });
          validationSpan.end();
          return {
            status: 'rejected' as const,
            reason: error instanceof Error ? error : new Error(String(error)),
          };
        }
      });

      // Wait for all validations to complete
      const results = await Promise.allSettled(validationPromises);

      // Collect all failures
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason);

      // If any validation failed, throw an aggregated error
      if (failures.length > 0) {
        const errorMessages = failures.map((error) => error.message).join('; ');
        const aggregatedError = new Error(`Validation failures: ${errorMessages}`);
        span.recordException(aggregatedError);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
        throw aggregatedError;
      }

      span.setStatus({ code: api.SpanStatusCode.OK });
      return true;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * IFulfillmentStrategy implementation - Get wallet ID for an intent
   */
  getWalletIdForIntent(_intent: Intent): Promise<WalletType> {
    return Promise.resolve('kernel');
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
        'intent.id': intent.intentHash,
        'intent.source_chain': intent.route.source.toString(),
        'intent.destination_chain': intent.route.destination.toString(),
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
              'intent.id': intent.intentHash,
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
                  feeSpan.recordException(error as Error);
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
            validationSpan.recordException(error as Error);
            validationSpan.setAttribute('validation.passed', false);
            validationSpan.setStatus({ code: api.SpanStatusCode.ERROR });
            return {
              validation: validationName,
              passed: false,
              error: error instanceof Error ? error.message : 'Unknown error',
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
      span.recordException(error as Error);
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
