import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { OpenTelemetryService } from '@/modules/opentelemetry';

/**
 * Common span attributes for TVM operations
 */
export interface TvmSpanAttributes {
  chainId?: string | number;
  address?: string;
  intentHash?: string;
  transactionHash?: string;
  operation?: string;
  [key: string]: any;
}

/**
 * Utility class for creating consistent OpenTelemetry spans in TVM module
 */
export class TvmTracingUtils {
  /**
   * Creates a span with common TVM attributes
   * @param otelService - OpenTelemetry service instance
   * @param name - Span name (e.g., 'tvm.reader.getBalance')
   * @param attributes - Span attributes
   * @returns OpenTelemetry span
   */
  static createSpan(
    otelService: OpenTelemetryService,
    name: string,
    attributes: TvmSpanAttributes,
  ): api.Span {
    const spanAttributes: Record<string, any> = {};

    // Add common attributes with tvm prefix
    if (attributes.chainId !== undefined) {
      spanAttributes['tvm.chain_id'] = attributes.chainId.toString();
    }
    if (attributes.address) {
      spanAttributes['tvm.address'] = attributes.address;
    }
    if (attributes.intentHash) {
      spanAttributes['tvm.intent_hash'] = attributes.intentHash;
    }
    if (attributes.transactionHash) {
      spanAttributes['tvm.transaction_hash'] = attributes.transactionHash;
    }
    if (attributes.operation) {
      spanAttributes['tvm.operation'] = attributes.operation;
    }

    // Add any additional attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (!['chainId', 'address', 'intentHash', 'transactionHash', 'operation'].includes(key)) {
        spanAttributes[`tvm.${key}`] = value?.toString();
      }
    });

    return otelService.startSpan(name, { attributes: spanAttributes });
  }

  /**
   * Creates span attributes from an intent
   * @param intent - Intent object
   * @returns Span attributes
   */
  static createIntentAttributes(intent: Intent): TvmSpanAttributes {
    if (!intent.sourceChainId) {
      throw new Error('intent sourceChainId is missing');
    }
    return {
      intentHash: intent.intentHash,
      source_chain: intent.sourceChainId.toString(),
      destination_chain: intent.destination.toString(),
      has_tokens: intent.route.tokens.length > 0,
      has_calls: intent.route.calls.length > 0,
      reward_deadline: intent.reward.deadline.toString(),
    };
  }

  /**
   * Wraps an async operation with a span
   * @param otelService - OpenTelemetry service instance
   * @param name - Span name
   * @param attributes - Span attributes
   * @param operation - Async operation to execute
   * @returns Result of the operation
   */
  static async withSpan<T>(
    otelService: OpenTelemetryService,
    name: string,
    attributes: TvmSpanAttributes,
    operation: (span: api.Span) => Promise<T>,
  ): Promise<T> {
    const activeSpan = api.trace.getActiveSpan();
    const span = activeSpan || this.createSpan(otelService, name, attributes);

    try {
      const result = await operation(span);
      if (!activeSpan) {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }
      return result;
    } catch (error) {
      if (!activeSpan) {
        span.recordException(error as Error);
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
      }
      throw error;
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }
}
