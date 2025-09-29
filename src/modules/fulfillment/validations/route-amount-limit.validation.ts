import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { formatUnits, maxUint256, parseUnits } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { denormalize, normalize } from '@/common/tokens/normalize';
import { min, sum } from '@/common/utils/math';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class RouteAmountLimitValidation implements Validation {
  constructor(
    private readonly tokenConfigService: TokenConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const span = api.trace.getActiveSpan();

    span?.setAttributes({
      'validation.name': 'RouteAmountLimitValidation',
      'intent.hash': intent.intentHash,
      'intent.source_chain': intent.sourceChainId?.toString(),
      'intent.destination_chain': intent.destination?.toString(),
      'route.tokens.count': intent.route.tokens?.length || 0,
    });

    try {
      // Calculate total value being transferred
      const normalizedTokens = this.tokenConfigService.normalize(
        intent.destination,
        intent.route.tokens,
      );
      const totalValue = sum(normalizedTokens, 'amount');
      span?.setAttribute('route.total_value', totalValue.toString());

      // Get the smallest token limit from configuration
      const tokenLimits = intent.route.tokens.map((token, index) => {
        const { limit, decimals } = this.tokenConfigService.getTokenConfig(
          intent.destination,
          token.token,
        );

        let limitWei: bigint;
        if (!limit?.max) {
          // If no limit is set, return a very large number (effectively no limit)
          limitWei = maxUint256;
          span?.setAttribute(`route.token.${index}.limit`, 'unlimited');
        } else {
          // Extract max value from either number or object format
          limitWei = parseUnits(limit.max.toString(), decimals);
          span?.setAttributes({
            [`route.token.${index}.limit`]: limit.max.toString(),
            [`route.token.${index}.limit_wei`]: limitWei.toString(),
          });
        }

        const normalizedLimit = normalize(limitWei, decimals);
        span?.setAttribute(`route.token.${index}.normalized_limit`, normalizedLimit.toString());

        return normalizedLimit;
      });

      // If no tokens in route, validation passes
      if (tokenLimits.length === 0) {
        span?.setAttributes({
          'route.has_tokens': false,
          'route.within_limit': true,
        });
        span?.setStatus({ code: api.SpanStatusCode.OK });
        return true;
      }

      const limit = min(tokenLimits);
      span?.setAttributes({
        'route.effective_limit': limit.toString(),
        'route.within_limit': totalValue <= limit,
      });

      if (totalValue > limit) {
        // Convert to human-readable format for error message
        const totalValueFormatted = formatUnits(denormalize(totalValue, 18), 18);
        const limitFormatted = formatUnits(denormalize(limit, 18), 18);
        throw new ValidationError(
          `Total value ${totalValueFormatted} exceeds route limit ${limitFormatted} for route ${intent.sourceChainId}-${intent.destination}`,
          ValidationErrorType.PERMANENT,
          'RouteAmountLimitValidation',
        );
      }

      span?.setStatus({ code: api.SpanStatusCode.OK });
      return true;
    } catch (error) {
      span?.recordException(error as Error);
      span?.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    }
  }
}
