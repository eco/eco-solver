import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class DuplicateRewardTokensValidation implements Validation {
  constructor(private readonly otelService: OpenTelemetryService) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.DuplicateRewardTokensValidation', {
        attributes: {
          'validation.name': 'DuplicateRewardTokensValidation',
          'intent.hash': intent.intentHash,
          'intent.source_chain': intent.route.source?.toString(),
          'intent.destination_chain': intent.route.destination?.toString(),
        },
      });

    try {
      const rewardTokens = intent.reward.tokens || [];
      span.setAttribute('reward.tokens.count', rewardTokens.length);

      if (rewardTokens.length === 0) {
        if (!activeSpan) {
          span.setStatus({ code: api.SpanStatusCode.OK });
        }
        return true;
      }

      const tokenAddresses = rewardTokens.map((token) => token.token.toLowerCase());
      const uniqueTokenAddresses = new Set(tokenAddresses);

      span.setAttributes({
        'reward.tokens.unique_count': uniqueTokenAddresses.size,
        'reward.tokens.has_duplicates': tokenAddresses.length !== uniqueTokenAddresses.size,
      });

      if (tokenAddresses.length !== uniqueTokenAddresses.size) {
        const duplicates = tokenAddresses.filter(
          (address, index) => tokenAddresses.indexOf(address) !== index,
        );
        span.setAttribute('reward.tokens.duplicates', duplicates.join(','));
        throw new Error(
          `Duplicate reward tokens found: ${duplicates.join(', ')}. Each token address must be unique.`,
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
