import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';

import { Validation } from './validation.interface';

@Injectable()
export class ExpirationValidation implements Validation {
  constructor(
    private readonly fulfillmentConfigService: FulfillmentConfigService,
    private readonly proverService: ProverService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.ExpirationValidation', {
        attributes: {
          'validation.name': 'ExpirationValidation',
          'intent.hash': intent.intentHash,
          'intent.source_chain': intent.route.source?.toString(),
          'intent.destination_chain': intent.route.destination?.toString(),
        },
      });

    try {
      const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

      span.setAttributes({
        'expiration.current_timestamp': currentTimestamp.toString(),
        'expiration.deadline': intent.reward.deadline?.toString() || 'none',
      });

      if (!intent.reward.deadline) {
        throw new Error('Intent must have a deadline');
      }

      const timeUntilDeadline = intent.reward.deadline - currentTimestamp;
      span.setAttribute('expiration.time_until_deadline', timeUntilDeadline.toString());

      if (intent.reward.deadline <= currentTimestamp) {
        span.setAttribute('expiration.expired', true);
        throw new Error(
          `Intent deadline ${intent.reward.deadline} has expired. Current time: ${currentTimestamp}`,
        );
      }

      // Get the maximum deadline buffer required by provers for this route
      const bufferSeconds = this.proverService.getMaxDeadlineBuffer(
        Number(intent.route.source),
        Number(intent.route.destination),
      );

      span.setAttributes({
        'expiration.required_buffer': bufferSeconds.toString(),
        'expiration.has_sufficient_buffer': timeUntilDeadline > bufferSeconds,
      });

      if (intent.reward.deadline <= currentTimestamp + bufferSeconds) {
        throw new Error(
          `Intent deadline ${intent.reward.deadline} is too close. Need at least ${bufferSeconds} seconds buffer for this route`,
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
