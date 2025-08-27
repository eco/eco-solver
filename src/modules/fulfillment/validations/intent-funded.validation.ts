import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class IntentFundedValidation implements Validation {
  constructor(
    private readonly blockchainReader: BlockchainReaderService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    this.logger.setContext(IntentFundedValidation.name);
  }

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.IntentFundedValidation', {
        attributes: {
          'validation.name': 'IntentFundedValidation',
          'intent.id': intent.intentHash,
          'intent.source_chain': intent.sourceChainId?.toString() || 'unknown',
          'intent.destination_chain': intent.destination.toString(),
        },
      });

    const sourceChainId = intent.sourceChainId;

    try {
      if (!sourceChainId) {
        throw new ValidationError(
          `Intent ${intent.intentHash} is missing source chain ID`,
          ValidationErrorType.PERMANENT,
          'IntentFundedValidation',
        );
      }

      span.setAttribute('funding.checking_chain', sourceChainId.toString());

      // Always perform on-chain verification for intent funding status
      const isFunded = await this.blockchainReader.isIntentFunded(sourceChainId, intent);

      // If we have vault address, add it to span for debugging
      if (intent.vaultAddress) {
        span.setAttribute('funding.vault_address', intent.vaultAddress);
      }

      span.setAttributes({
        'funding.is_funded': isFunded,
        'funding.source_chain': sourceChainId.toString(),
        'funding.method': 'on_chain_check',
      });

      if (!isFunded) {
        throw new ValidationError(
          `Intent ${intent.intentHash} is not funded on chain ${sourceChainId}`,
          ValidationErrorType.TEMPORARY,
          'IntentFundedValidation',
        );
      }

      this.logger.debug(`Intent ${intent.intentHash} is funded on chain ${sourceChainId}`);

      if (!activeSpan) {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }
      return true;
    } catch (error) {
      if (!activeSpan) {
        span.recordException(error as Error);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }

      // If it's already our error message, re-throw it
      if (error.message.includes('is not funded')) {
        throw error;
      }

      // Otherwise, wrap the error as TEMPORARY (network issues, etc.)
      this.logger.error(`Failed to check funding status for intent ${intent.intentHash}:`, error);
      throw new ValidationError(
        `Failed to verify intent funding status: ${error.message}`,
        ValidationErrorType.TEMPORARY,
        'IntentFundedValidation',
      );
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }
}
