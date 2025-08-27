import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class RouteTokenValidation implements Validation {
  constructor(
    private evmConfigService: EvmConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.RouteTokenValidation', {
        attributes: {
          'validation.name': 'RouteTokenValidation',
          'intent.hash': intent.intentHash,
          'intent.source_chain': intent.sourceChainId?.toString(),
          'intent.destination_chain': intent.destination?.toString(),
          'route.tokens.count': intent.route.tokens?.length || 0,
          'reward.tokens.count': intent.reward.tokens?.length || 0,
        },
      });

    try {
      const destinationChainId = Number(intent.destination);

      const nativeTokenAmount = intent.route.calls.reduce((acc, call) => acc + call.value, 0n);
      span.setAttribute('route.native_token_amount', nativeTokenAmount.toString());

      if (nativeTokenAmount !== 0n) {
        throw new Error(`Native token transfers are not supported`);
      }

      // Validate route tokens
      for (let i = 0; i < intent.route.tokens.length; i++) {
        const routeToken = intent.route.tokens[i];
        const isSupported = this.evmConfigService.isTokenSupported(
          destinationChainId,
          routeToken.token,
        );

        span.setAttributes({
          [`route.token.${i}.address`]: routeToken.token,
          [`route.token.${i}.amount`]: routeToken.amount.toString(),
          [`route.token.${i}.supported`]: isSupported,
        });

        // Check if token is supported when there are restrictions
        if (!isSupported) {
          throw new Error(
            `Token ${routeToken.token} is not supported on chain ${destinationChainId}`,
          );
        }
      }

      // Validate reward tokens (on source chain)
      const sourceChainId = Number(intent.sourceChainId);
      for (let i = 0; i < intent.reward.tokens.length; i++) {
        const token = intent.reward.tokens[i];
        const isSupported = this.evmConfigService.isTokenSupported(sourceChainId, token.token);

        span.setAttributes({
          [`reward.token.${i}.address`]: token.token,
          [`reward.token.${i}.amount`]: token.amount.toString(),
          [`reward.token.${i}.supported`]: isSupported,
        });

        // Check if reward token is supported when there are restrictions
        if (!isSupported) {
          throw new Error(`Reward token ${token.token} is not supported on chain ${sourceChainId}`);
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
