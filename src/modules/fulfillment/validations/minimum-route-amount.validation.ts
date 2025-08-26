import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { normalize } from '@/common/tokens/normalize';
import { min, sum } from '@/common/utils/math';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class MinimumRouteAmountValidation implements Validation {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.MinimumRouteAmountValidation', {
        attributes: {
          'validation.name': 'MinimumRouteAmountValidation',
          'intent.hash': intent.intentId,
          'intent.destination_chain': intent.destination?.toString(),
          'route.tokens.count': intent.route.tokens?.length || 0,
        },
      });

    try {
      // Calculate total value being transferred
      const normalizedTokens = this.fulfillmentConfigService.normalize(
        intent.destination,
        intent.route.tokens,
      );
      const totalValue = sum(normalizedTokens, 'amount');
      span.setAttribute('route.total_value', totalValue.toString());

      // Get minimum limits from all tokens
      const tokenMinimums = intent.route.tokens.map((token, index) => {
        const { limit, decimals } = this.fulfillmentConfigService.getToken(
          intent.destination,
          token.token,
        );

        if (!limit) {
          // If no limit is set, no minimum requirement (return max value to exclude from min calculation)
          span.setAttribute(`route.token.${index}.minimum`, 'none');
          return BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        }

        // Extract min value from either number format (no min) or object format
        const minLimit = typeof limit === 'number' ? 0 : (limit.min ?? 0);

        if (minLimit === 0) {
          // No minimum requirement (return max value to exclude from min calculation)
          span.setAttribute(`route.token.${index}.minimum`, 'none');
          return BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
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
      if (
        minimumAmount ===
        BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      ) {
        span.setAttribute('route.has_minimum', false);
        if (!activeSpan) {
          span.setStatus({ code: api.SpanStatusCode.OK });
        }
        return true;
      }

      span.setAttributes({
        'route.has_minimum': true,
        'route.effective_minimum': minimumAmount.toString(),
        'route.meets_minimum': totalValue >= minimumAmount,
      });

      if (totalValue < minimumAmount) {
        throw new Error(
          `Total route value ${totalValue} is below minimum amount ${minimumAmount} for destination chain ${intent.destination}`,
        );
      }

      if (!activeSpan) {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }
      return true;
    } catch (error) {
      if (!activeSpan) {
        span.recordException(error as Error);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }
      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }
}
