import { TraceCorrelation } from './trace-correlation'

// Mock dd-trace and opentelemetry modules
const mockDatadogTracer = {
  scope: jest.fn().mockReturnValue({
    active: jest.fn(),
  }),
}

const mockOpenTelemetry = {
  trace: {
    getActiveSpan: jest.fn(),
  },
}

// Mock the dynamic require calls in TraceCorrelation
jest.mock('dd-trace', () => mockDatadogTracer, { virtual: true })
jest.mock('@opentelemetry/api', () => mockOpenTelemetry, { virtual: true })

describe('TraceCorrelation', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    // Ensure NODE_ENV is set to 'test' for consistent test behavior
    process.env.NODE_ENV = 'test'
    // Reset mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('when APM is disabled', () => {
    beforeEach(() => {
      process.env.DD_TRACE_ENABLED = 'false'
    })

    it('should return undefined for trace ID', () => {
      const traceId = TraceCorrelation.getTraceId()
      expect(traceId).toBeUndefined()
    })

    it('should return undefined for span ID', () => {
      const spanId = TraceCorrelation.getSpanId()
      expect(spanId).toBeUndefined()
    })

    it('should return undefined for parent ID', () => {
      const parentId = TraceCorrelation.getParentId()
      expect(parentId).toBeUndefined()
    })

    it('should return undefined for sampling priority', () => {
      const priority = TraceCorrelation.getSamplingPriority()
      expect(priority).toBeUndefined()
    })

    it('should return minimal context with service name only', () => {
      process.env.DD_SERVICE = 'test-service'
      const context = TraceCorrelation.createCorrelationContext()

      expect(context).toEqual({
        service_name: 'test-service',
        env: 'test',
      })
    })

    it('should return empty headers', () => {
      const headers = TraceCorrelation.injectTraceHeaders()
      expect(headers).toEqual({})
    })

    it('should return false for tracing enabled check', () => {
      const isEnabled = TraceCorrelation.isTracingEnabled()
      expect(isEnabled).toBe(false)
    })
  })

  describe('when APM is enabled', () => {
    beforeEach(() => {
      process.env.DD_TRACE_ENABLED = 'true'
      process.env.DD_SERVICE = 'eco-solver'
    })

    describe('with Datadog tracer active span', () => {
      beforeEach(() => {
        const mockSpan = {
          context: jest.fn().mockReturnValue({
            toTraceId: jest.fn().mockReturnValue('1234567890abcdef'),
            toSpanId: jest.fn().mockReturnValue('abcdef1234567890'),
            parentId: 'parent123456789',
            sampling: { priority: 1 },
          }),
          operationName: 'test.operation',
        }

        mockDatadogTracer.scope().active = jest.fn().mockReturnValue(mockSpan)
      })

      it('should return trace ID from Datadog tracer', () => {
        const traceId = TraceCorrelation.getTraceId()
        expect(traceId).toBe('1234567890abcdef')
      })

      it('should return span ID from Datadog tracer', () => {
        const spanId = TraceCorrelation.getSpanId()
        expect(spanId).toBe('abcdef1234567890')
      })

      it('should return parent ID from Datadog tracer', () => {
        const parentId = TraceCorrelation.getParentId()
        expect(parentId).toBe('parent123456789')
      })

      it('should return sampling priority from Datadog tracer', () => {
        const priority = TraceCorrelation.getSamplingPriority()
        expect(priority).toBe(1)
      })

      it('should return complete correlation context', () => {
        const context = TraceCorrelation.createCorrelationContext()

        expect(context).toEqual({
          trace_id: '1234567890abcdef',
          span_id: 'abcdef1234567890',
          parent_id: 'parent123456789',
          sampling_priority: 1,
          service_name: 'eco-solver',
          env: 'test',
        })
      })

      it('should inject trace headers', () => {
        const headers = TraceCorrelation.injectTraceHeaders()

        expect(headers).toEqual({
          'x-datadog-trace-id': '1234567890abcdef',
          'x-datadog-parent-id': 'abcdef1234567890',
          traceparent: '00-1234567890abcdef-abcdef1234567890-01',
        })
      })

      it('should return operation name', () => {
        const operationName = TraceCorrelation.getCurrentOperationName()
        expect(operationName).toBe('test.operation')
      })

      it('should return true for tracing enabled', () => {
        const isEnabled = TraceCorrelation.isTracingEnabled()
        expect(isEnabled).toBe(true)
      })
    })

    describe('with no active span', () => {
      beforeEach(() => {
        mockDatadogTracer.scope().active = jest.fn().mockReturnValue(null)
        mockOpenTelemetry.trace.getActiveSpan = jest.fn().mockReturnValue(null)
      })

      it('should return undefined for trace ID when no active span', () => {
        const traceId = TraceCorrelation.getTraceId()
        expect(traceId).toBeUndefined()
      })

      it('should return undefined for span ID when no active span', () => {
        const spanId = TraceCorrelation.getSpanId()
        expect(spanId).toBeUndefined()
      })

      it('should return context with only service name when no active span', () => {
        const context = TraceCorrelation.createCorrelationContext()

        expect(context).toEqual({
          trace_id: undefined,
          span_id: undefined,
          parent_id: undefined,
          sampling_priority: undefined,
          service_name: 'eco-solver',
          env: 'test',
        })
      })
    })

    describe('with OpenTelemetry fallback', () => {
      beforeEach(() => {
        // Make Datadog tracer unavailable
        mockDatadogTracer.scope().active = jest.fn().mockReturnValue(null)

        // Mock OpenTelemetry active span
        const mockOtelSpan = {
          spanContext: jest.fn().mockReturnValue({
            traceId: 'otel_trace_1234',
            spanId: 'otel_span_5678',
          }),
        }
        mockOpenTelemetry.trace.getActiveSpan = jest.fn().mockReturnValue(mockOtelSpan)
      })

      it('should fallback to OpenTelemetry for trace ID', () => {
        const traceId = TraceCorrelation.getTraceId()
        expect(traceId).toBe('otel_trace_1234')
      })

      it('should fallback to OpenTelemetry for span ID', () => {
        const spanId = TraceCorrelation.getSpanId()
        expect(spanId).toBe('otel_span_5678')
      })
    })

    describe('error handling', () => {
      beforeEach(() => {
        // Mock console.debug to avoid console output during tests
        jest.spyOn(console, 'debug').mockImplementation(() => {})
      })

      it('should handle errors gracefully and return undefined', () => {
        mockDatadogTracer.scope = jest.fn().mockImplementation(() => {
          throw new Error('Tracer error')
        })

        const traceId = TraceCorrelation.getTraceId()
        const spanId = TraceCorrelation.getSpanId()

        expect(traceId).toBeUndefined()
        expect(spanId).toBeUndefined()
        expect(console.debug).toHaveBeenCalled()
      })
    })
  })

  describe('extractTraceFromHeaders', () => {
    it('should extract trace context from Datadog headers', () => {
      const headers = {
        'x-datadog-trace-id': '1234567890abcdef',
        'x-datadog-parent-id': 'parent123456789',
      }

      const context = TraceCorrelation.extractTraceFromHeaders(headers)

      expect(context).toEqual({
        trace_id: '1234567890abcdef',
        parent_id: 'parent123456789',
        service_name: 'eco-solver',
        env: 'test',
      })
    })

    it('should extract trace context from OpenTelemetry traceparent header', () => {
      const headers = {
        traceparent: '00-1234567890abcdef1234567890abcdef-abcdef1234567890-01',
      }

      const context = TraceCorrelation.extractTraceFromHeaders(headers)

      expect(context).toEqual({
        trace_id: '1234567890abcdef1234567890abcdef',
        span_id: 'abcdef1234567890',
        service_name: 'eco-solver',
        env: 'test',
      })
    })

    it('should handle malformed traceparent header gracefully', () => {
      const headers = {
        traceparent: 'invalid-format',
      }

      const context = TraceCorrelation.extractTraceFromHeaders(headers)

      expect(context).toEqual({
        service_name: 'eco-solver',
        env: 'test',
      })
    })

    it('should prioritize Datadog headers over OpenTelemetry', () => {
      const headers = {
        'x-datadog-trace-id': 'dd_trace_123',
        traceparent: '00-otel_trace_456-otel_span_789-01',
      }

      const context = TraceCorrelation.extractTraceFromHeaders(headers)

      expect(context.trace_id).toBe('dd_trace_123')
    })

    it('should return minimal context for empty headers', () => {
      const context = TraceCorrelation.extractTraceFromHeaders({})

      expect(context).toEqual({
        service_name: 'eco-solver',
        env: 'test',
      })
    })
  })

  describe('default service name', () => {
    it('should use default service name when DD_SERVICE not set', () => {
      delete process.env.DD_SERVICE

      const context = TraceCorrelation.createCorrelationContext()

      expect(context.service_name).toBe('eco-solver')
    })

    it('should use DD_SERVICE environment variable', () => {
      process.env.DD_SERVICE = 'custom-service'

      const context = TraceCorrelation.createCorrelationContext()

      expect(context.service_name).toBe('custom-service')
    })
  })
})
