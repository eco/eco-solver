import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { now } from '@/common/utils/time';
import { FulfillmentConfigService } from '@/modules/config/services';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
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
    const span = api.trace.getActiveSpan();

    span?.setAttributes({
      'validation.name': 'ExpirationValidation',
      'intent.hash': intent.intentHash,
      'intent.source_chain': intent.sourceChainId?.toString(),
      'intent.destination_chain': intent.destination?.toString(),
    });

    try {
      const currentTimestamp = BigInt(now());

      span?.setAttributes({
        'expiration.current_timestamp': currentTimestamp.toString(),
        'expiration.deadline': intent.reward.deadline?.toString() || 'none',
      });

      if (!intent.reward.deadline) {
        throw new ValidationError(
          'Intent must have a deadline',
          ValidationErrorType.PERMANENT,
          'ExpirationValidation',
        );
      }

      const timeUntilDeadline = intent.reward.deadline - currentTimestamp;
      span?.setAttribute('expiration.time_until_deadline', timeUntilDeadline.toString());

      if (intent.reward.deadline <= currentTimestamp) {
        span?.setAttribute('expiration.expired', true);
        throw new ValidationError(
          `Intent deadline ${intent.reward.deadline} has expired. Current time: ${currentTimestamp}`,
          ValidationErrorType.PERMANENT,
          'ExpirationValidation',
        );
      }

      // Get the maximum deadline buffer required by provers for this route
      const prover = this.proverService.getProver(
        Number(intent.sourceChainId),
        intent.reward.prover,
      );
      if (!prover) {
        throw new ValidationError('Prover not found.');
      }

      const bufferSeconds = prover.getDeadlineBuffer();

      span?.setAttributes({
        'expiration.required_buffer': bufferSeconds.toString(),
        'expiration.has_sufficient_buffer': timeUntilDeadline > bufferSeconds,
      });

      if (intent.reward.deadline <= currentTimestamp + bufferSeconds) {
        throw new ValidationError(
          `Intent deadline ${intent.reward.deadline} is too close. Need at least ${bufferSeconds} seconds buffer for this route`,
          ValidationErrorType.PERMANENT,
          'ExpirationValidation',
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
