import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class ExecutorBalanceValidation implements Validation {
  constructor(
    private readonly blockchainReaderService: BlockchainReaderService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.ExecutorBalanceValidation', {
        attributes: {
          'validation.name': 'ExecutorBalanceValidation',
          'intent.hash': intent.intentHash,
          'intent.destination_chain': intent.destination?.toString(),
          'route.tokens.count': intent.route.tokens?.length || 0,
        },
      });

    try {
      // This should verify that the executor has enough funds to execute the fulfillment
      // on the destination chain

      const chainID = intent.destination;

      const checkRequests = intent.route.tokens.map(async ({ token, amount }, index) => {
        const balance = await context.getWalletBalance(chainID, token);

        span.setAttributes({
          [`executor.balance.${index}.token`]: token,
          [`executor.balance.${index}.required`]: amount.toString(),
          [`executor.balance.${index}.actual`]: balance.toString(),
          [`executor.balance.${index}.sufficient`]: balance >= amount,
        });

        return { enough: balance >= amount, token, balance, required: amount };
      });

      const checks = await Promise.all(checkRequests);

      const notEnough = checks.filter((check) => !check.enough);

      if (notEnough.length) {
        const tokens = notEnough.map(({ token }) => token);
        span.setAttribute('executor.balance.insufficient_tokens', tokens.join(', '));
        throw new Error(`Not enough token balance found for: ${tokens.join(', ')}`);
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
