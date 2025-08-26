import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Address, decodeFunctionData, erc20Abi, isAddressEqual } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class RouteCallsValidation implements Validation {
  constructor(
    private evmConfigService: EvmConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(intent: Intent, _context: ValidationContext): Promise<boolean> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('validation.RouteCallsValidation', {
        attributes: {
          'validation.name': 'RouteCallsValidation',
          'intent.id': intent.intentId,
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

      const tokens = this.evmConfigService.getSupportedTokens(intent.destination);
      span.setAttribute('supported.tokens.count', tokens.length);

      for (let i = 0; i < intent.route.calls.length; i++) {
        const call = intent.route.calls[i];
        const isTokenCall = tokens.some((token) =>
          isAddressEqual(token.address as Address, call.target),
        );

        span.setAttributes({
          [`route.call.${i}.target`]: call.target,
          [`route.call.${i}.value`]: call.value?.toString() || '0',
          [`route.call.${i}.isTokenCall`]: isTokenCall,
        });

        if (!isTokenCall) {
          throw new Error(
            `Invalid route call: target ${call.target} is not a supported token address`,
          );
        }

        try {
          const fn = decodeFunctionData({
            abi: erc20Abi,
            data: call.data,
          });

          span.setAttribute(`route.call.${i}.functionName`, fn.functionName);

          if (fn.functionName !== 'transfer') {
            throw new Error(
              `Invalid route call: only ERC20 transfer function is allowed, got ${fn.functionName}`,
            );
          }
        } catch (error) {
          // Invalid ERC20 call data
          throw new Error(
            `Invalid route call: unable to decode ERC20 call data for target ${call.target}`,
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
