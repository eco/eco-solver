import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { Logger } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class IntentFundedValidation implements Validation {
  constructor(
    private readonly logger: Logger,
    private readonly blockchainReader: BlockchainReaderService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    const span = api.trace.getActiveSpan();

    span?.setAttributes({
      'validation.name': 'IntentFundedValidation',
      'intent.hash': intent.intentHash,
      'intent.source_chain': intent.sourceChainId?.toString() || 'unknown',
      'intent.destination_chain': intent.destination.toString(),
    });

    if (context.quoting) {
      // Skip validation when is quoting
      span?.setAttribute('validation.skipped', true);
      span?.setAttribute('validation.quoting', true);
      span?.setStatus({ code: api.SpanStatusCode.OK });
      return true;
    }

    const sourceChainId = intent.sourceChainId;

    try {
      span?.setAttribute('funding.checking_chain', sourceChainId.toString());

      // Always perform on-chain verification for intent funding status
      const isFunded = await this.blockchainReader.isIntentFunded(sourceChainId, intent);

      span?.setAttributes({
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

      this.logger.debug('Intent is funded on chain', {
        intentHash: intent.intentHash,
        sourceChainId: sourceChainId.toString(),
      });

      span?.setStatus({ code: api.SpanStatusCode.OK });
      return true;
    } catch (error) {
      span?.recordException(toError(error));
      span?.setStatus({ code: api.SpanStatusCode.ERROR });

      // If it's already our error message, re-throw it
      if (getErrorMessage(error).includes('is not funded')) {
        throw error;
      }

      // Otherwise, wrap the error as TEMPORARY (network issues, etc.)
      this.logger.error('Failed to check funding status for intent', {
        intentHash: intent.intentHash,
        sourceChainId: sourceChainId.toString(),
        error: toError(error),
      });
      throw new ValidationError(
        `Failed to verify intent funding status: ${getErrorMessage(error)}`,
        ValidationErrorType.TEMPORARY,
        'IntentFundedValidation',
      );
    }
  }
}
