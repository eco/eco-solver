/**
 * APM Trace Correlation Module
 * Provides distributed tracing correlation for better observability across services
 * Compatible with Datadog APM and other OpenTelemetry-compatible tracers
 */

/**
 * APM context information for trace correlation
 */
export interface APMContext {
  trace_id?: string
  span_id?: string
  parent_id?: string
  sampling_priority?: number
  service_name?: string
  operation_name?: string
  env?: string
}

/**
 * Utility class for extracting trace information from APM providers
 * Supports Datadog APM and OpenTelemetry-compatible tracers
 */
export class TraceCorrelation {
  /**
   * Check if APM tracing is enabled dynamically from environment
   */
  private static isAPMEnabled(): boolean {
    return process.env.DD_TRACE_ENABLED === 'true'
  }

  /**
   * Get service name dynamically from environment
   */
  private static getServiceName(): string {
    return process.env.DD_SERVICE || 'eco-solver'
  }

  /**
   * Get environment name dynamically, preferring DD_ENV but falling back to NODE_ENV
   * This method is also available publicly for use by other logging components
   */
  private static getEnvironment(): string {
    return process.env.DD_ENV || process.env.NODE_ENV || 'development'
  }

  /**
   * Public utility method to get environment name for consistent logging
   */
  static getEnvironmentName(): string {
    return this.getEnvironment()
  }

  /**
   * Get the current active trace ID from APM tracer
   */
  static getTraceId(): string | undefined {
    if (!this.isAPMEnabled()) {
      return undefined
    }

    try {
      // Try Datadog APM first
      const ddTrace = this.getDatadogTracer()
      if (ddTrace) {
        const span = ddTrace.scope().active()
        if (span) {
          const traceId = span.context().toTraceId()
          return traceId ? String(traceId) : undefined
        }
      }

      // Try OpenTelemetry as fallback
      const otelTraceId = this.getOpenTelemetryTraceId()
      if (otelTraceId) {
        return otelTraceId
      }
    } catch (error) {
      // Silently handle APM errors to avoid breaking application flow
      // eslint-disable-next-line no-console
      console.debug('Failed to retrieve trace ID:', error.message)
    }

    return undefined
  }

  /**
   * Get the current active span ID from APM tracer
   */
  static getSpanId(): string | undefined {
    if (!this.isAPMEnabled()) {
      return undefined
    }

    try {
      // Try Datadog APM first
      const ddTrace = this.getDatadogTracer()
      if (ddTrace) {
        const span = ddTrace.scope().active()
        if (span) {
          const spanId = span.context().toSpanId()
          return spanId ? String(spanId) : undefined
        }
      }

      // Try OpenTelemetry as fallback
      const otelSpanId = this.getOpenTelemetrySpanId()
      if (otelSpanId) {
        return otelSpanId
      }
    } catch (error) {
      // Silently handle APM errors
      // eslint-disable-next-line no-console
      console.debug('Failed to retrieve span ID:', error.message)
    }

    return undefined
  }

  /**
   * Get the parent span ID from APM tracer
   */
  static getParentId(): string | undefined {
    if (!this.isAPMEnabled()) {
      return undefined
    }

    try {
      const ddTrace = this.getDatadogTracer()
      if (ddTrace) {
        const span = ddTrace.scope().active()
        if (span) {
          const parentId = span.context().parentId
          return parentId ? String(parentId) : undefined
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Failed to retrieve parent ID:', error.message)
    }

    return undefined
  }

  /**
   * Get sampling priority for the current trace
   */
  static getSamplingPriority(): number | undefined {
    if (!this.isAPMEnabled()) {
      return undefined
    }

    try {
      const ddTrace = this.getDatadogTracer()
      if (ddTrace) {
        const span = ddTrace.scope().active()
        if (span) {
          return span.context().sampling?.priority
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Failed to retrieve sampling priority:', error.message)
    }

    return undefined
  }

  /**
   * Create a complete APM correlation context
   */
  static createCorrelationContext(): APMContext {
    if (!this.isAPMEnabled()) {
      return {
        service_name: this.getServiceName(),
        env: this.getEnvironment(),
      }
    }

    return {
      trace_id: this.getTraceId(),
      span_id: this.getSpanId(),
      parent_id: this.getParentId(),
      sampling_priority: this.getSamplingPriority(),
      service_name: this.getServiceName(),
      env: this.getEnvironment(),
    }
  }

  /**
   * Inject trace correlation into headers for downstream services
   */
  static injectTraceHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}

    if (!this.isAPMEnabled()) {
      return headers
    }

    const traceId = this.getTraceId()
    const spanId = this.getSpanId()

    if (traceId) {
      // Datadog trace headers
      headers['x-datadog-trace-id'] = traceId
    }

    if (spanId) {
      headers['x-datadog-parent-id'] = spanId
    }

    // OpenTelemetry compatible headers
    if (traceId && spanId) {
      headers['traceparent'] = `00-${traceId}-${spanId}-01`
    }

    return headers
  }

  /**
   * Extract trace context from incoming headers
   */
  static extractTraceFromHeaders(headers: Record<string, string>): APMContext {
    const context: APMContext = {
      service_name: this.getServiceName(),
      env: this.getEnvironment(),
    }

    // Extract from Datadog headers
    if (headers['x-datadog-trace-id']) {
      context.trace_id = headers['x-datadog-trace-id']
    }

    if (headers['x-datadog-parent-id']) {
      context.parent_id = headers['x-datadog-parent-id']
    }

    // Extract from OpenTelemetry traceparent header (only if Datadog headers not present)
    const traceparent = headers['traceparent']
    if (traceparent && !context.trace_id) {
      const parts = traceparent.split('-')
      if (parts.length === 4) {
        context.trace_id = parts[1]
        context.span_id = parts[2]
      }
    }

    return context
  }

  /**
   * Check if APM tracing is enabled and available
   */
  static isTracingEnabled(): boolean {
    return this.isAPMEnabled() && (this.getDatadogTracer() !== null || this.hasOpenTelemetry())
  }

  /**
   * Get operation name from current span if available
   */
  static getCurrentOperationName(): string | undefined {
    if (!this.isAPMEnabled()) {
      return undefined
    }

    try {
      const ddTrace = this.getDatadogTracer()
      if (ddTrace) {
        const span = ddTrace.scope().active()
        if (span) {
          return span.operationName
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Failed to retrieve operation name:', error.message)
    }

    return undefined
  }

  /**
   * Private: Attempt to get Datadog tracer instance
   */
  private static getDatadogTracer(): any {
    try {
      // Try to require dd-trace (Datadog APM)
      return require('dd-trace')
    } catch (error) {
      // dd-trace not available
      return null
    }
  }

  /**
   * Private: Check if OpenTelemetry is available
   */
  private static hasOpenTelemetry(): boolean {
    try {
      require('@opentelemetry/api')
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Private: Get trace ID from OpenTelemetry
   */
  private static getOpenTelemetryTraceId(): string | undefined {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { trace } = require('@opentelemetry/api')
      const span = trace.getActiveSpan()
      if (span) {
        return span.spanContext().traceId
      }
    } catch (error) {
      // OpenTelemetry not available or no active span
    }
    return undefined
  }

  /**
   * Private: Get span ID from OpenTelemetry
   */
  private static getOpenTelemetrySpanId(): string | undefined {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { trace } = require('@opentelemetry/api')
      const span = trace.getActiveSpan()
      if (span) {
        return span.spanContext().spanId
      }
    } catch (error) {
      // OpenTelemetry not available or no active span
    }
    return undefined
  }
}
