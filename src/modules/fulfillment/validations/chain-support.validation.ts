import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class ChainSupportValidation implements Validation {
  constructor(
    private readonly blockchainService: BlockchainExecutorService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.ChainSupportValidation', {
        attributes: {
          'validation.name': 'ChainSupportValidation',
          'intent.hash': intent.intentId,
          'intent.source_chain': intent.sourceChainId?.toString(),
          'intent.destination_chain': intent.destination?.toString(),
        },
      });

    try {
      if (!intent.sourceChainId) {
        throw new Error('Intent must have source chain ID');
      }

      if (!intent.destination) {
        throw new Error('Intent must have destination chain ID');
      }

      span.setAttribute('chain.source.id', intent.sourceChainId.toString());
      span.setAttribute('chain.destination.id', intent.destination.toString());

      const sourceSupported = this.blockchainService.isChainSupported(intent.sourceChainId);
      span.setAttribute('chain.source.supported', sourceSupported);

      if (!sourceSupported) {
        throw new Error(`Source chain ${intent.sourceChainId} is not supported`);
      }

      const destSupported = this.blockchainService.isChainSupported(intent.destination);
      span.setAttribute('chain.destination.supported', destSupported);

      if (!destSupported) {
        throw new Error(`Target chain ${intent.destination} is not supported`);
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
