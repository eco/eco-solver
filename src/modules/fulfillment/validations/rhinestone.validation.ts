import { Injectable, Optional } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { FeeCalculationValidation } from '@/modules/fulfillment/validations/fee-calculation.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { RhinestoneValidationService } from '@/modules/rhinestone/services/rhinestone-validation.service';

/**
 * Rhinestone validation wrapper for fulfillment strategy.
 * Validates native token support, single calls, and fee profitability.
 */
@Injectable()
export class RhinestoneValidation implements FeeCalculationValidation {
  constructor(
    private readonly otelService: OpenTelemetryService,
    @Optional()
    private readonly validationService?: RhinestoneValidationService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    return this.otelService.withSpan('rhinestone-validation.validate', async (span) => {
      span.setAttributes({
        'validation.name': 'RhinestoneValidation',
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.sourceChainId.toString(),
        'intent.destination_chain': intent.destination.toString(),
        'intent.route_calls': intent.route.calls.length,
        'validation.quoting': context.quoting ?? false,
      });

      try {
        if (!this.validationService) {
          throw new Error(
            'RhinestoneValidationService is missing. Rhinestone module may not be enabled.',
          );
        }

        // Validate native token support
        this.validationService.validateNativeToken(intent);
        span.addEvent('native-token-validated');

        // Validate single call (v1 limitation)
        this.validationService.validateSingleCall(intent);
        span.addEvent('single-call-validated');

        if (context.quoting) {
          // Skip expensive operations during quoting
          span.setAttribute('validation.skipped_onchain', true);
          span.setStatus({ code: api.SpanStatusCode.OK });
          return true;
        }

        // Calculate and validate fees (includes profitability check)
        const feeDetails = await this.calculateFee(intent, context);

        span.setAttributes({
          'fee.base': feeDetails.fee.base.toString(),
          'fee.percentage': feeDetails.fee.percentage.toString(),
          'fee.total': feeDetails.fee.total.toString(),
          'fee.bps': feeDetails.fee.bps,
          'reward.tokens': feeDetails.reward.tokens.toString(),
          'route.tokens': feeDetails.route.tokens.toString(),
        });

        span.setStatus({ code: api.SpanStatusCode.OK });
        return true;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
        throw error;
      }
    });
  }

  async calculateFee(intent: Intent, context: ValidationContext) {
    return this.otelService.withSpan('rhinestone-validation.calculate-fee', async (span) => {
      span.setAttributes({
        'intent.hash': intent.intentHash,
        'validation.quoting': context.quoting ?? false,
      });

      try {
        if (!this.validationService) {
          throw new Error(
            'RhinestoneValidationService is missing. Rhinestone module may not be enabled.',
          );
        }

        // Delegate to service for fee calculation
        const feeDetails = await this.validationService.calculateAndValidateFees(intent, {
          skipCalculation: context.quoting,
        });

        span.setAttributes({
          'fee.base': feeDetails.fee.base.toString(),
          'fee.percentage': feeDetails.fee.percentage.toString(),
          'fee.total': feeDetails.fee.total.toString(),
        });

        span.setStatus({ code: api.SpanStatusCode.OK });
        return {
          reward: {
            native: feeDetails.reward.nativeAmount,
            tokens: feeDetails.reward.tokens.reduce((sum, t) => sum + t.amount, 0n),
          },
          route: {
            native: feeDetails.route.nativeAmount,
            tokens: feeDetails.route.tokens.reduce((sum, t) => sum + t.amount, 0n),
            maximum: {
              native: feeDetails.route.maximum.nativeAmount,
              tokens: feeDetails.route.maximum.tokens.reduce((sum, t) => sum + t.amount, 0n),
            },
          },
          fee: feeDetails.fee,
        };
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
        throw error;
      }
    });
  }
}
