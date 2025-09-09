import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class RouteCallsValidation implements Validation {
  constructor(
    private readonly otelService: OpenTelemetryService,
    private readonly blockchainReaderService: BlockchainReaderService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.RouteCallsValidation', {
        attributes: {
          'validation.name': 'RouteCallsValidation',
          'intent.id': intent.intentHash,
          'intent.destination_chain': intent.destination.toString(),
          'route.calls.count': intent.route.calls?.length || 0,
          'route.portal': intent.route.portal,
        },
      });

    try {
      // Validate route calls
      if (!intent.route.calls || intent.route.calls.length === 0) {
        // It's valid to have no calls (token-only transfer)
        span.setAttribute('route.calls.empty', true);
        if (!activeSpan) {
          span.setStatus({ code: api.SpanStatusCode.OK });
        }
        return true;
      }

      // Validate each call using blockchain reader service
      // The blockchain reader service handles both token address validation and transfer call validation
      for (let i = 0; i < intent.route.calls.length; i++) {
        const call = intent.route.calls[i];

        span.setAttributes({
          [`route.call.${i}.target`]: call.target,
          [`route.call.${i}.value`]: call.value?.toString() || '0',
        });

        try {
          const isValidTokenTransferCall =
            await this.blockchainReaderService.validateTokenTransferCall(intent.destination, call);

          span.setAttribute(`route.call.${i}.validTokenTransferCall`, isValidTokenTransferCall);

          if (!isValidTokenTransferCall) {
            throw new Error(`Invalid token transfer call for target ${call.target}`);
          }
        } catch (error) {
          span.setAttribute(`route.call.${i}.validationError`, (error as Error).message);
          throw new Error(
            `Invalid route call for target ${call.target} on chain ${intent.destination}: ${(error as Error).message}`,
          );
        }
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
