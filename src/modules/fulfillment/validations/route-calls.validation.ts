import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { decodeFunctionData, erc20Abi } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Validation } from './validation.interface';

@Injectable()
export class RouteCallsValidation implements Validation {
  constructor(
    private tokenConfigService: TokenConfigService,
    private readonly otelService: OpenTelemetryService,
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

      // Detect chain type for validation logic
      const chainType = ChainTypeDetector.detect(intent.destination);
      span.setAttribute('chain.type', chainType);

      const tokens = this.tokenConfigService.getSupportedTokens(intent.destination);
      span.setAttribute('supported.tokens.count', tokens.length);

      for (let i = 0; i < intent.route.calls.length; i++) {
        const call = intent.route.calls[i];

        // Normalize addresses
        const isTokenCall =
          tokens.length === 0 || tokens.some((token) => token.address === call.target);

        // Add debugging attributes for TVM address normalization
        span.setAttribute(`route.call.${i}.target`, call.target);

        span.setAttributes({
          [`route.call.${i}.target`]: call.target,
          [`route.call.${i}.value`]: call.value?.toString() || '0',
          [`route.call.${i}.isTokenCall`]: isTokenCall,
        });

        if (!isTokenCall) {
          throw new Error(
            `Invalid route call: target ${call.target} is not a supported token address on chain ${intent.destination}`,
          );
        }

        // Validate call data based on chain type
        if (chainType === ChainType.EVM || chainType === ChainType.TVM) {
          // Both EVM and TVM use the same ABI encoding for contract calls
          try {
            const fn = decodeFunctionData({
              abi: erc20Abi,
              data: call.data,
            });

            span.setAttribute(`route.call.${i}.functionName`, fn.functionName);

            if (fn.functionName !== 'transfer') {
              const tokenStandard = chainType === ChainType.TVM ? 'TRC20' : 'ERC20';
              throw new Error(
                `Invalid route call: only ${tokenStandard} transfer function is allowed, got ${fn.functionName}`,
              );
            }
          } catch (error) {
            // Invalid token call data
            const tokenStandard = chainType === ChainType.TVM ? 'TRC20' : 'ERC20';
            throw new Error(
              `Invalid route call: unable to decode ${tokenStandard} call data for target ${call.target}`,
            );
          }
        } else if (chainType === ChainType.SVM) {
          // Solana uses different instruction format
          // For now, skip validation as it requires different decoding logic
          span.setAttribute(`route.call.${i}.validation`, 'skipped for SVM');
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
