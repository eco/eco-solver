import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Params, PinoLogger } from 'nestjs-pino';

/**
 * Custom Logger that extends PinoLogger with structured logging by default
 * All log methods use structured format: { msg: string, ...data }
 * Automatically handles BigInt serialization
 * Automatically injects OpenTelemetry trace context when available
 *
 * Usage:
 * ```typescript
 * logger.info('Processing intent', { intentHash: '0x...', chainId: 1n });
 * logger.error('Execution failed', error, { intentHash: '0x...' });
 * ```
 */
@Injectable()
export class Logger extends PinoLogger {
  constructor(params: Params) {
    super(params);
  }

  /**
   * Extract trace context from the active OpenTelemetry span
   * Returns trace_id and span_id if a span is active, undefined otherwise
   */
  private getTraceContext(): { trace_id: string; span_id: string } | undefined {
    const span = api.trace.getActiveSpan();
    if (!span) {
      return undefined;
    }

    const spanContext = span.spanContext();
    if (!spanContext || !api.trace.isSpanContextValid(spanContext)) {
      return undefined;
    }

    return {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
    };
  }

  /**
   * Enrich log data with trace context and correlation attributes
   * Adds trace_id, span_id, and any correlation attributes from span
   */
  private enrichWithTraceContext(data: Record<string, any>): Record<string, any> {
    const traceContext = this.getTraceContext();
    if (!traceContext) {
      return data;
    }

    const enriched: Record<string, any> = { ...data, ...traceContext };

    // Also extract correlation attributes if present in the active span
    const span = api.trace.getActiveSpan();
    if (span) {
      const attributes = (span as any).attributes;
      if (attributes) {
        // Add correlation_id if present
        if (attributes['trace.correlation.id']) {
          enriched.correlation_id = attributes['trace.correlation.id'];
        }
        // Add stage if present
        if (attributes['trace.stage']) {
          enriched.stage = attributes['trace.stage'];
        }
      }
    }

    return enriched;
  }

  /**
   * Log info message with optional structured data
   * Supports both:
   * - info(message, data) - structured logging
   * - info(obj) - PinoLogger compatibility
   */
  info(message: string, data?: Record<string, any>): void;
  info(obj: unknown, msg?: string, ...args: any[]): void;
  info(
    messageOrObj: string | unknown,
    dataOrMsg?: Record<string, any> | string,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      // Our structured format: info(message, data?)
      const data = dataOrMsg as Record<string, any> | undefined;
      const baseData = { msg: messageOrObj };
      if (data) {
        const serialized = this.serializeBigInt(data);
        const enriched = this.enrichWithTraceContext({ ...baseData, ...serialized });
        super.info(enriched);
      } else {
        const enriched = this.enrichWithTraceContext(baseData);
        super.info(enriched);
      }
    } else {
      // PinoLogger format: info(obj, msg?, ...args)
      super.info(messageOrObj, dataOrMsg as string | undefined, ...args);
    }
  }

  /**
   * Log debug message with optional structured data
   */
  debug(message: string, data?: Record<string, any>): void;
  debug(obj: unknown, msg?: string, ...args: any[]): void;
  debug(
    messageOrObj: string | unknown,
    dataOrMsg?: Record<string, any> | string,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      const data = dataOrMsg as Record<string, any> | undefined;
      const baseData = { msg: messageOrObj };
      if (data) {
        const serialized = this.serializeBigInt(data);
        const enriched = this.enrichWithTraceContext({ ...baseData, ...serialized });
        super.debug(enriched);
      } else {
        const enriched = this.enrichWithTraceContext(baseData);
        super.debug(enriched);
      }
    } else {
      super.debug(messageOrObj, dataOrMsg as string | undefined, ...args);
    }
  }

  /**
   * Log warning message with optional structured data
   */
  warn(message: string, data?: Record<string, any>): void;
  warn(obj: unknown, msg?: string, ...args: any[]): void;
  warn(
    messageOrObj: string | unknown,
    dataOrMsg?: Record<string, any> | string,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      const data = dataOrMsg as Record<string, any> | undefined;
      const baseData = { msg: messageOrObj };
      if (data) {
        const serialized = this.serializeBigInt(data);
        const enriched = this.enrichWithTraceContext({ ...baseData, ...serialized });
        super.warn(enriched);
      } else {
        const enriched = this.enrichWithTraceContext(baseData);
        super.warn(enriched);
      }
    } else {
      super.warn(messageOrObj, dataOrMsg as string | undefined, ...args);
    }
  }

  /**
   * Log error message with optional error object and structured data
   * @param message - The log message
   * @param error - Optional Error object or unknown error
   * @param data - Optional structured data
   */
  error(message: string, error?: Error | unknown, data?: Record<string, any>): void;
  error(obj: unknown, msg?: string, ...args: any[]): void;
  error(
    messageOrObj: string | unknown,
    errorOrMsg?: Error | unknown | string,
    dataOrArgs?: Record<string, any> | any,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      // Our structured format
      const logData: any = { msg: messageOrObj };

      if (errorOrMsg && typeof errorOrMsg !== 'string') {
        logData.error = this.formatError(errorOrMsg);
      }

      if (dataOrArgs && typeof dataOrArgs === 'object') {
        Object.assign(logData, this.serializeBigInt(dataOrArgs));
      }

      const enriched = this.enrichWithTraceContext(logData);
      super.error(enriched);
    } else {
      // PinoLogger format
      super.error(messageOrObj, errorOrMsg as string | undefined, dataOrArgs, ...args);
    }
  }

  /**
   * Log fatal message with optional error object and structured data
   */
  fatal(message: string, error?: Error | unknown, data?: Record<string, any>): void;
  fatal(obj: unknown, msg?: string, ...args: any[]): void;
  fatal(
    messageOrObj: string | unknown,
    errorOrMsg?: Error | unknown | string,
    dataOrArgs?: Record<string, any> | any,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      const logData: any = { msg: messageOrObj };

      if (errorOrMsg && typeof errorOrMsg !== 'string') {
        logData.error = this.formatError(errorOrMsg);
      }

      if (dataOrArgs && typeof dataOrArgs === 'object') {
        Object.assign(logData, this.serializeBigInt(dataOrArgs));
      }

      const enriched = this.enrichWithTraceContext(logData);
      super.fatal(enriched);
    } else {
      super.fatal(messageOrObj, errorOrMsg as string | undefined, dataOrArgs, ...args);
    }
  }

  /**
   * Log trace message with optional structured data
   */
  trace(message: string, data?: Record<string, any>): void;
  trace(obj: unknown, msg?: string, ...args: any[]): void;
  trace(
    messageOrObj: string | unknown,
    dataOrMsg?: Record<string, any> | string,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      const data = dataOrMsg as Record<string, any> | undefined;
      const baseData = { msg: messageOrObj };
      if (data) {
        const serialized = this.serializeBigInt(data);
        const enriched = this.enrichWithTraceContext({ ...baseData, ...serialized });
        super.trace(enriched);
      } else {
        const enriched = this.enrichWithTraceContext(baseData);
        super.trace(enriched);
      }
    } else {
      super.trace(messageOrObj, dataOrMsg as string | undefined, ...args);
    }
  }

  /**
   * Serialize BigInt values to strings for JSON compatibility
   * Handles top-level properties in objects
   */
  private serializeBigInt(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'bigint') {
      return data.toString();
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.serializeBigInt(item));
    }

    if (typeof data === 'object' && !(data instanceof Error) && !(data instanceof Date)) {
      const serialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this.serializeBigInt(value);
      }
      return serialized;
    }

    return data;
  }

  /**
   * Format error object for logging
   */
  private formatError(error: Error | unknown): any {
    if (error instanceof Error) {
      // Don't spread error object to avoid overwriting explicit properties
      const formatted: any = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      // Add custom properties if they exist
      Object.keys(error).forEach((key) => {
        if (key !== 'name' && key !== 'message' && key !== 'stack') {
          formatted[key] = (error as any)[key];
        }
      });
      return formatted;
    }
    return { message: String(error) };
  }
}
