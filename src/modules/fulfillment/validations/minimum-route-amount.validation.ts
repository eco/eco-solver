import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { formatUnits, parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { denormalize, normalize } from '@/common/tokens/normalize';
import { min, sum } from '@/common/utils/math';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

const MaxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

@Injectable()
export class MinimumRouteAmountValidation implements Validation {
  constructor(
    private readonly tokenConfigService: TokenConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'validation.MinimumRouteAmountValidation',
      {
        attributes: {
          'validation.name': 'MinimumRouteAmountValidation',
          'intent.hash': intent.intentHash,
          'intent.destination_chain': intent.destination?.toString(),
          'route.tokens.count': intent.route.tokens?.length || 0,
        },
      },
      (span: api.Span) => {
        try {
          // Calculate total value being transferred
          const normalizedTokens = this.tokenConfigService.normalize(
            intent.destination,
            intent.route.tokens,
          );
          const totalValue = sum(normalizedTokens, 'amount');
          span.setAttribute('route.total_value', totalValue.toString());

          // Get minimum limits from all tokens
          const tokenMinimums = intent.route.tokens.map((token, index) => {
            const { limit, decimals } = this.tokenConfigService.getTokenConfig(
              intent.destination,
              token.token,
            );

            if (!limit) {
              // If no limit is set, no minimum requirement (return max value to exclude from min calculation)
              span.setAttribute(`route.token.${index}.minimum`, 'none');
              return MaxUint256;
            }

            // Extract min value from either number format (no min) or object format
            const minLimit = limit.min ?? 0;

            if (minLimit === 0) {
              // No minimum requirement (return max value to exclude from min calculation)
              span.setAttribute(`route.token.${index}.minimum`, 'none');
              return MaxUint256;
            }

            const limitWei = parseUnits(minLimit.toString(), decimals);
            const normalizedMin = normalize(limitWei, decimals);

            span.setAttributes({
              [`route.token.${index}.minimum`]: minLimit.toString(),
              [`route.token.${index}.minimum_wei`]: limitWei.toString(),
              [`route.token.${index}.normalized_minimum`]: normalizedMin.toString(),
            });

            return normalizedMin;
          });

          // Use the smallest minimum as the threshold
          const minimumAmount = min(tokenMinimums);

          // If all tokens have no minimum (all returned max value), then no minimum requirement
          if (minimumAmount === MaxUint256) {
            span.setAttribute('route.has_minimum', false);
            span.setStatus({ code: api.SpanStatusCode.OK });
            return true;
          }

          span.setAttributes({
            'route.has_minimum': true,
            'route.effective_minimum': minimumAmount.toString(),
            'route.meets_minimum': totalValue >= minimumAmount,
          });

          if (totalValue < minimumAmount) {
            // Convert back to human-readable format for error message
            // We use 18 decimals as the normalized base
            const totalValueFormatted = formatUnits(denormalize(totalValue, 18), 18);
            const minimumFormatted = formatUnits(denormalize(minimumAmount, 18), 18);
            throw new Error(
              `Total route value ${totalValueFormatted} is below minimum amount ${minimumFormatted} for destination chain ${intent.destination}`,
            );
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
      },
    );
  }
}
