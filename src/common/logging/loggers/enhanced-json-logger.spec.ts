import { EnhancedJsonLogger } from './enhanced-json-logger'
import { LogLevel, EcoBusinessContext } from '../types'
import { TraceCorrelation } from '../apm/trace-correlation'

// Mock TraceCorrelation
jest.mock('../apm/trace-correlation', () => ({
  TraceCorrelation: {
    isTracingEnabled: jest.fn(() => false),
    createCorrelationContext: jest.fn(() => ({
      trace_id: 'mock-trace-id',
      span_id: 'mock-span-id',
      service_name: 'eco-solver',
    })),
    getCurrentOperationName: jest.fn(() => 'mock-operation'),
    getEnvironmentName: jest.fn(() => 'test'),
  },
}))

describe('EnhancedJsonLogger', () => {
  let logger: EnhancedJsonLogger
  let logStructuredSpy: jest.SpyInstance

  beforeEach(() => {
    logger = new EnhancedJsonLogger('TestEnhancedLogger', {
      enableDatadogOptimization: false, // Disable for cleaner test assertions
      enableEnrichment: true,
      enablePerformanceTracking: true,
      defaultTags: ['test:enabled', 'env:test'],
    })

    // Mock the logStructured method to avoid actual logging during tests
    logStructuredSpy = jest.spyOn(logger, 'logStructured').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
    logger.clearCache()
  })

  describe('logEnhanced', () => {
    it('should log with enhanced structure including all context', () => {
      const context: Partial<EcoBusinessContext> = {
        intent_hash: 'test-intent-hash',
        quote_id: 'test-quote-id',
        source_chain_id: 1,
        destination_chain_id: 137,
      }

      const metadata = {
        operation: {
          type: 'test_operation',
          status: 'completed',
          duration_ms: 150,
        },
        metrics: {
          response_time: 150,
          success_count: 1,
        },
        tags: ['custom:tag'],
      }

      logger.logEnhanced('Test enhanced message', 'info', context, metadata)

      expect(logStructuredSpy).toHaveBeenCalledTimes(1)
      const logCall = logStructuredSpy.mock.calls[0]
      const logStructure = logCall[0]
      const logLevel = logCall[1]

      expect(logLevel).toBe('info')
      expect(logStructure).toMatchObject({
        message: 'Test enhanced message',
        service: 'eco-solver',
        status: 'info',
        ddsource: 'nodejs',
        'logger.name': 'TestEnhancedLogger',
      })

      // Check ddtags contains our custom tags
      expect(logStructure.ddtags).toContain('test:enabled')
      expect(logStructure.ddtags).toContain('env:test')
      expect(logStructure.ddtags).toContain('custom:tag')

      // Check eco context
      expect(logStructure.eco).toMatchObject({
        intent_hash: 'test-intent-hash',
        quote_id: 'test-quote-id',
        source_chain_id: 1,
        destination_chain_id: 137,
      })

      // Check operation context
      expect(logStructure.operation).toMatchObject({
        type: 'test_operation',
        status: 'completed',
        duration_ms: 150,
        correlation_id: expect.stringMatching(/^testenhancedlogger_\d+_[a-z0-9]+$/),
      })

      // Check metrics
      expect(logStructure.metrics).toEqual({
        response_time: 150,
        success_count: 1,
      })

      // Check performance tracking
      expect(logStructure.performance).toMatchObject({
        logging_overhead_ms: expect.any(Number),
      })
    })

    it('should handle error metadata correctly', () => {
      const error = new Error('Test error message')
      error.name = 'CustomError'
      ;(error as any).code = 'TEST_ERROR'

      logger.logEnhanced('Error occurred', 'error', { intent_hash: 'error-intent' }, { error })

      expect(logStructuredSpy).toHaveBeenCalledTimes(1)
      const logStructure = logStructuredSpy.mock.calls[0][0]

      expect(logStructure.error).toMatchObject({
        kind: 'CustomError',
        message: 'Test error message',
        stack: expect.stringContaining('Test error message'),
        code: 'TEST_ERROR',
        fingerprint: expect.any(String),
      })
    })

    it('should enrich with APM context when tracing is enabled', () => {
      // Enable tracing mock
      ;(TraceCorrelation.isTracingEnabled as jest.Mock).mockReturnValue(true)

      logger.logEnhanced('APM test message', 'info')

      expect(logStructuredSpy).toHaveBeenCalledTimes(1)
      const logStructure = logStructuredSpy.mock.calls[0][0]

      expect(logStructure['dd.trace_id']).toBe('mock-trace-id')
      expect(logStructure['dd.span_id']).toBe('mock-span-id')
    })
  })

  describe('logBusinessEvent', () => {
    it('should log business events with proper categorization', () => {
      const context: Partial<EcoBusinessContext> = {
        intent_hash: 'business-intent',
        d_app_id: 'test-dapp',
      }

      logger.logBusinessEvent('intent_creation', 'Intent created successfully', context, {
        status: 'completed',
        duration_ms: 200,
        metrics: { gas_used: 21000 },
        severity: 'low',
      })

      expect(logStructuredSpy).toHaveBeenCalledTimes(1)
      const logStructure = logStructuredSpy.mock.calls[0][0]

      expect(logStructure.eco).toMatchObject({
        intent_hash: 'business-intent',
        d_app_id: 'test-dapp',
        event_type: 'intent_creation',
      })

      expect(logStructure.operation).toMatchObject({
        type: 'intent_creation',
        status: 'completed',
        duration_ms: 200,
      })

      expect(logStructure.metrics).toEqual({ gas_used: 21000 })
      expect(logStructure.ddtags).toContain('severity:low')
    })

    it('should determine log level from metadata status and errors', () => {
      // Test failed status
      logger.logBusinessEvent('test_event', 'Failed event', {}, { status: 'failed' })
      expect(logStructuredSpy.mock.calls[0][1]).toBe('error')

      // Test with error
      logger.logBusinessEvent('test_event', 'Error event', {}, { error: new Error('test') })
      expect(logStructuredSpy.mock.calls[1][1]).toBe('error')

      // Test critical severity
      logger.logBusinessEvent('test_event', 'Critical event', {}, { severity: 'critical' })
      expect(logStructuredSpy.mock.calls[2][1]).toBe('error')

      // Test high severity
      logger.logBusinessEvent('test_event', 'High severity event', {}, { severity: 'high' })
      expect(logStructuredSpy.mock.calls[3][1]).toBe('warn')
    })
  })

  describe('logPerformanceMetrics', () => {
    it('should log performance metrics with automatic level determination', () => {
      const metrics = {
        response_time_ms: 1500,
        throughput: 100,
        error_rate: 0.05,
        cpu_usage: 45,
        memory_usage: 60,
        success_count: 95,
        error_count: 5,
      }

      logger.logPerformanceMetrics('api_request', metrics, { intent_hash: 'perf-test' })

      expect(logStructuredSpy).toHaveBeenCalledTimes(1)
      const logStructure = logStructuredSpy.mock.calls[0][0]
      const logLevel = logStructuredSpy.mock.calls[0][1]

      expect(logLevel).toBe('info') // 1500ms is acceptable performance
      expect(logStructure.operation).toMatchObject({
        type: 'performance_measurement',
        status: 'completed',
        duration_ms: 1500,
      })

      expect(logStructure.metrics).toEqual(metrics)
      expect(logStructure.ddtags).toContain('operation:api_request')
      expect(logStructure.ddtags).toContain('performance_tier:acceptable')
    })

    it('should categorize performance levels correctly', () => {
      // Test excellent performance (< 100ms)
      logger.logPerformanceMetrics('fast_op', { response_time_ms: 50 })
      expect(logStructuredSpy.mock.calls[0][0].ddtags).toContain('performance_tier:excellent')

      // Test good performance (100-500ms)
      logger.logPerformanceMetrics('good_op', { response_time_ms: 300 })
      expect(logStructuredSpy.mock.calls[1][0].ddtags).toContain('performance_tier:good')

      // Test slow performance (2-5s)
      logger.logPerformanceMetrics('slow_op', { response_time_ms: 3000 })
      expect(logStructuredSpy.mock.calls[2][1]).toBe('warn')
      expect(logStructuredSpy.mock.calls[2][0].ddtags).toContain('performance_tier:slow')

      // Test critical performance (>5s)
      logger.logPerformanceMetrics('critical_op', { response_time_ms: 6000 })
      expect(logStructuredSpy.mock.calls[3][1]).toBe('warn')
      expect(logStructuredSpy.mock.calls[3][0].ddtags).toContain('performance_tier:critical')

      // Test with high error rate
      logger.logPerformanceMetrics('error_op', { response_time_ms: 100, error_rate: 0.15 })
      expect(logStructuredSpy.mock.calls[4][1]).toBe('error') // >10% error rate
    })
  })

  describe('logError', () => {
    it('should log errors with comprehensive context', () => {
      const error = new Error('Database connection failed')
      error.name = 'ConnectionError'
      ;(error as any).code = 'CONN_REFUSED'

      const context: Partial<EcoBusinessContext> = {
        intent_hash: 'error-intent',
        source_chain_id: 1,
      }

      const metadata = {
        recoverable: true,
        retry_count: 2,
        upstream_service: 'database',
        user_impact: 'degraded' as const,
        correlation_id: 'custom-correlation-id',
      }

      logger.logError(error, 'database_operation', context, metadata)

      expect(logStructuredSpy).toHaveBeenCalledTimes(1)
      const logStructure = logStructuredSpy.mock.calls[0][0]
      const logLevel = logStructuredSpy.mock.calls[0][1]

      expect(logLevel).toBe('error')
      expect(logStructure.message).toBe('Error in database_operation: Database connection failed')

      expect(logStructure.operation).toMatchObject({
        type: 'database_operation',
        status: 'failed',
        retry_count: 2,
      })

      expect(logStructure.error).toMatchObject({
        kind: 'ConnectionError',
        message: 'Database connection failed',
        code: 'CONN_REFUSED',
        fingerprint: expect.any(String),
      })

      expect(logStructure.ddtags).toContain('error_type:ConnectionError')
      expect(logStructure.ddtags).toContain('recoverable:true')
      expect(logStructure.ddtags).toContain('user_impact:degraded')
    })

    it('should generate consistent error fingerprints for identical errors', () => {
      const error1 = new Error('Identical error message')
      const error2 = new Error('Identical error message')

      logger.logError(error1, 'operation1')
      logger.logError(error2, 'operation2')

      const fingerprint1 = logStructuredSpy.mock.calls[0][0].error.fingerprint
      const fingerprint2 = logStructuredSpy.mock.calls[1][0].error.fingerprint

      // Should have different fingerprints due to different operations
      expect(fingerprint1).not.toBe(fingerprint2)

      // But same error with same operation should have same fingerprint
      logger.logError(error1, 'operation1')
      const fingerprint3 = logStructuredSpy.mock.calls[2][0].error.fingerprint
      expect(fingerprint1).toBe(fingerprint3)
    })
  })

  describe('logWithCache', () => {
    it('should cache context for performance optimization', () => {
      const contextProvider = jest.fn(
        () =>
          ({
            intent_hash: 'cached-intent',
            source_chain_id: 1,
          }) as Partial<EcoBusinessContext>,
      )

      // First call should invoke provider
      logger.logWithCache('cache-key-1', 'First message', contextProvider, 'info', 60000)
      expect(contextProvider).toHaveBeenCalledTimes(1)

      // Second call should use cache
      logger.logWithCache('cache-key-1', 'Second message', contextProvider, 'info', 60000)
      expect(contextProvider).toHaveBeenCalledTimes(1) // Still called only once

      expect(logStructuredSpy).toHaveBeenCalledTimes(2)

      // Both calls should have same eco context
      const firstContext = logStructuredSpy.mock.calls[0][0].eco
      const secondContext = logStructuredSpy.mock.calls[1][0].eco

      expect(firstContext).toEqual(secondContext)
      expect(firstContext.intent_hash).toBe('cached-intent')
      expect(firstContext.source_chain_id).toBe(1)
    })

    it('should refresh cache when TTL expires', (done) => {
      const contextProvider = jest.fn(
        () =>
          ({
            intent_hash: `cached-${Date.now()}`,
            source_chain_id: 1,
          }) as Partial<EcoBusinessContext>,
      )

      // First call
      logger.logWithCache('expire-test', 'Message 1', contextProvider, 'info', 50) // 50ms TTL

      // Wait for cache to expire
      setTimeout(() => {
        logger.logWithCache('expire-test', 'Message 2', contextProvider, 'info', 50)

        expect(contextProvider).toHaveBeenCalledTimes(2) // Should be called twice due to expiration
        done()
      }, 60)
    })
  })

  describe('createBatchLogger', () => {
    it('should create batch logger with flush functionality', () => {
      const batchLogger = logger.createBatchLogger(100, 3) // 100ms interval, max 3 entries

      batchLogger.add('Message 1', 'info')
      batchLogger.add('Message 2', 'warn')

      expect(batchLogger.size()).toBe(2)
      expect(logStructuredSpy).not.toHaveBeenCalled() // Should not log until batch is full or flushed

      // Adding third message should trigger flush
      batchLogger.add('Message 3', 'error')

      expect(logStructuredSpy).toHaveBeenCalled()
      expect(batchLogger.size()).toBe(0) // Batch should be cleared after flush
    })

    it('should flush automatically after interval', (done) => {
      const batchLogger = logger.createBatchLogger(50, 10) // 50ms interval

      batchLogger.add('Timed message', 'info')

      expect(logStructuredSpy).not.toHaveBeenCalled()

      setTimeout(() => {
        expect(logStructuredSpy).toHaveBeenCalled() // Should have flushed automatically
        expect(batchLogger.size()).toBe(0)
        done()
      }, 60)
    })

    it('should allow manual flushing', () => {
      const batchLogger = logger.createBatchLogger(1000, 10)

      batchLogger.add('Manual flush test', 'info')
      expect(logStructuredSpy).not.toHaveBeenCalled()

      batchLogger.flush()
      expect(logStructuredSpy).toHaveBeenCalled()
      expect(batchLogger.size()).toBe(0)
    })
  })

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      logger.logWithCache('key1', 'Message 1', () => ({ intent_hash: 'value1' }))
      logger.logWithCache('key2', 'Message 2', () => ({ intent_hash: 'value2' }))

      const stats = logger.getCacheStats()
      expect(stats.size).toBe(2)
      expect(stats.keys).toEqual(['key1', 'key2'])
    })

    it('should clear cache completely', () => {
      logger.logWithCache('key1', 'Message', () => ({ intent_hash: 'value' }))
      expect(logger.getCacheStats().size).toBe(1)

      logger.clearCache()
      expect(logger.getCacheStats().size).toBe(0)
    })
  })

  describe('constructor options', () => {
    it('should respect configuration options', () => {
      const customLogger = new EnhancedJsonLogger('CustomLogger', {
        enableEnrichment: false,
        enablePerformanceTracking: false,
        defaultTags: ['custom:tag'],
      })

      const logSpy = jest.spyOn(customLogger, 'logStructured').mockImplementation(() => {})

      customLogger.logEnhanced('Test message')

      const logStructure = logSpy.mock.calls[0][0]

      // Should not have performance tracking
      expect(logStructure.performance).toBeUndefined()

      // Should have custom tags
      expect(logStructure.ddtags).toContain('custom:tag')

      logSpy.mockRestore()
    })
  })

  describe('error fingerprint generation', () => {
    it('should generate unique fingerprints for different error patterns', () => {
      const logger = new EnhancedJsonLogger('FingerprintTest')
      const logSpy = jest.spyOn(logger, 'logStructured').mockImplementation(() => {})

      const error1 = new Error('Network timeout occurred')
      const error2 = new Error('Database connection failed')
      const error3 = new Error('Validation error: missing field')

      logger.logError(error1, 'network_operation')
      logger.logError(error2, 'database_operation')
      logger.logError(error3, 'validation_operation')

      const fingerprint1 = logSpy.mock.calls[0][0].error?.fingerprint
      const fingerprint2 = logSpy.mock.calls[1][0].error?.fingerprint
      const fingerprint3 = logSpy.mock.calls[2][0].error?.fingerprint

      expect(fingerprint1).not.toBe(fingerprint2)
      expect(fingerprint2).not.toBe(fingerprint3)
      expect(fingerprint1).not.toBe(fingerprint3)

      logSpy.mockRestore()
    })
  })
})
