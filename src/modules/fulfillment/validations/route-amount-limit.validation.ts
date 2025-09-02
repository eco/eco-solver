import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { normalize } from '@/common/tokens/normalize';
import { min, sum } from '@/common/utils/math';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class RouteAmountLimitValidation implements Validation {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.RouteAmountLimitValidation', {
        attributes: {
          'validation.name': 'RouteAmountLimitValidation',
          'intent.hash': intent.intentHash,
          'intent.source_chain': intent.sourceChainId?.toString(),
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

      // Get the smallest token limit from configuration
      const tokenLimits = intent.route.tokens.map((token, index) => {
        const { limit, decimals } = this.fulfillmentConfigService.getToken(
          intent.destination,
          token.token,
        );

        let limitWei: bigint;
        if (!limit?.max) {
          // If no limit is set, return a very large number (effectively no limit)
          limitWei = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
          span.setAttribute(`route.token.${index}.limit`, 'unlimited');
        } else {
          // Extract max value from either number or object format
          limitWei = parseUnits(limit.max.toString(), decimals);
          span.setAttributes({
            [`route.token.${index}.limit`]: limit.max.toString(),
            [`route.token.${index}.limit_wei`]: limitWei.toString(),
          });
        }

        const normalizedLimit = normalize(limitWei, decimals);
        span.setAttribute(`route.token.${index}.normalized_limit`, normalizedLimit.toString());

        return normalizedLimit;
      });

      // If no tokens in route, validation passes
      if (tokenLimits.length === 0) {
        span.setAttributes({
          'route.has_tokens': false,
          'route.within_limit': true,
        });
        if (!activeSpan) {
          span.setStatus({ code: api.SpanStatusCode.OK });
        }
        return true;
      }

      const limit = min(tokenLimits);
      span.setAttributes({
        'route.effective_limit': limit.toString(),
        'route.within_limit': totalValue <= limit,
      });

      if (totalValue > limit) {
        throw new ValidationError(
          `Total value ${totalValue} exceeds route limit ${limit} for route ${intent.sourceChainId}-${intent.destination}`,
          ValidationErrorType.PERMANENT,
          'RouteAmountLimitValidation',
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
