import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';

import { Validation } from './validation.interface';

@Injectable()
export class ProverSupportValidation implements Validation {
  constructor(
    private readonly proverService: ProverService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.ProverSupportValidation', {
        attributes: {
          'validation.name': 'ProverSupportValidation',
          'intent.id': intent.intentHash,
          'intent.source_chain': intent.sourceChainId?.toString(),
          'intent.destination_chain': intent.destination.toString(),
        },
      });

    try {
      // Validate that the prover supports this route
      const proverResult = await this.proverService.validateIntentRoute(intent);

      span.setAttributes({
        'prover.validation.isValid': proverResult.isValid,
        'prover.validation.reason': proverResult.reason || 'Success',
      });

      if (!proverResult.isValid) {
        throw new Error(`Prover validation failed: ${proverResult.reason || 'Unknown reason'}`);
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
