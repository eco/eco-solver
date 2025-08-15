import { AnalyticsError, AnalyticsMessages, AnalyticsLogger } from '../errors'

describe('Analytics Error Classes', () => {
  describe('AnalyticsError', () => {
    it('should create error with message, code, and context', () => {
      const error = new AnalyticsError('Test message', 'TEST_CODE', { key: 'value' })

      expect(error.message).toBe('Test message')
      expect(error.code).toBe('TEST_CODE')
      expect(error.context).toEqual({ key: 'value' })
      expect(error.name).toBe('AnalyticsError')
      expect(error).toBeInstanceOf(Error)
    })

    it('should create error without context', () => {
      const error = new AnalyticsError('Test message', 'TEST_CODE')

      expect(error.message).toBe('Test message')
      expect(error.code).toBe('TEST_CODE')
      expect(error.context).toBeUndefined()
    })

    describe('static factory methods', () => {
      it('should create missingApiKey error', () => {
        const error = AnalyticsError.missingApiKey()

        expect(error.message).toBe('PostHog API key is required')
        expect(error.code).toBe('MISSING_API_KEY')
        expect(error.context).toBeUndefined()
      })

      it('should create eventCaptureFailed error', () => {
        const originalError = new Error('Original error')
        const error = AnalyticsError.eventCaptureFailed('test_event', 'user123', originalError)

        expect(error.message).toBe('Failed to capture event test_event for user user123')
        expect(error.code).toBe('EVENT_CAPTURE_FAILED')
        expect(error.context).toEqual({
          event: 'test_event',
          distinctId: 'user123',
          originalError,
        })
      })

      it('should create featureFlagCheckFailed error', () => {
        const originalError = new Error('Flag error')
        const error = AnalyticsError.featureFlagCheckFailed('test_flag', 'user123', originalError)

        expect(error.message).toBe('Failed to check feature flag test_flag for user user123')
        expect(error.code).toBe('FEATURE_FLAG_CHECK_FAILED')
        expect(error.context).toEqual({
          flag: 'test_flag',
          distinctId: 'user123',
          originalError,
        })
      })

      it('should create featureFlagGetFailed error', () => {
        const originalError = new Error('Get flag error')
        const error = AnalyticsError.featureFlagGetFailed('test_flag', 'user123', originalError)

        expect(error.message).toBe('Failed to get feature flag test_flag for user user123')
        expect(error.code).toBe('FEATURE_FLAG_GET_FAILED')
        expect(error.context).toEqual({
          flag: 'test_flag',
          distinctId: 'user123',
          originalError,
        })
      })

      it('should create allFlagsGetFailed error', () => {
        const originalError = new Error('Get all flags error')
        const error = AnalyticsError.allFlagsGetFailed('user123', originalError)

        expect(error.message).toBe('Failed to get all flags for user user123')
        expect(error.code).toBe('ALL_FLAGS_GET_FAILED')
        expect(error.context).toEqual({
          distinctId: 'user123',
          originalError,
        })
      })

      it('should create groupIdentifyFailed error', () => {
        const originalError = new Error('Group error')
        const error = AnalyticsError.groupIdentifyFailed('team', 'engineering', originalError)

        expect(error.message).toBe('Failed to identify group team:engineering')
        expect(error.code).toBe('GROUP_IDENTIFY_FAILED')
        expect(error.context).toEqual({
          groupType: 'team',
          groupKey: 'engineering',
          originalError,
        })
      })

      it('should create flushFailed error', () => {
        const originalError = new Error('Flush error')
        const error = AnalyticsError.flushFailed(originalError)

        expect(error.message).toBe('Failed to flush PostHog events')
        expect(error.code).toBe('FLUSH_FAILED')
        expect(error.context).toEqual({ originalError })
      })

      it('should create shutdownFailed error', () => {
        const originalError = new Error('Shutdown error')
        const error = AnalyticsError.shutdownFailed(originalError)

        expect(error.message).toBe('Failed to shutdown PostHog service')
        expect(error.code).toBe('SHUTDOWN_FAILED')
        expect(error.context).toEqual({ originalError })
      })

      it('should create posthogError error', () => {
        const originalError = new Error('PostHog error')
        const error = AnalyticsError.posthogError(originalError)

        expect(error.message).toBe('PostHog error occurred')
        expect(error.code).toBe('POSTHOG_ERROR')
        expect(error.context).toEqual({ originalError })
      })
    })
  })

  describe('AnalyticsMessages', () => {
    it('should return correct initialization messages', () => {
      expect(AnalyticsMessages.serviceInitialized()).toBe(
        'PostHog service initialized successfully',
      )
      expect(AnalyticsMessages.groupIdentified('team', 'engineering')).toBe(
        'Identified group team:engineering',
      )
    })

    it('should return correct operation success messages', () => {
      expect(AnalyticsMessages.eventsFlushSuccessful()).toBe(
        'Successfully flushed pending analytics events',
      )
      expect(AnalyticsMessages.serviceShutdownSuccessful()).toBe(
        'PostHog service shut down successfully',
      )
    })
  })

  describe('AnalyticsLogger', () => {
    let mockLogger: any

    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        debug: jest.fn(),
      }
    })

    it('should log errors with structured context', () => {
      const error = AnalyticsError.eventCaptureFailed(
        'test_event',
        'user123',
        new Error('Original'),
      )

      AnalyticsLogger.logError(mockLogger, error)

      expect(mockLogger.error).toHaveBeenCalledWith(error.message, {
        code: error.code,
        context: error.context,
        stack: error.stack,
      })
    })

    it('should log warnings with structured context', () => {
      const error = AnalyticsError.groupIdentifyFailed(
        'team',
        'engineering',
        new Error('Group error'),
      )

      AnalyticsLogger.logWarning(mockLogger, error)

      expect(mockLogger.warn).toHaveBeenCalledWith(error.message, {
        code: error.code,
        context: error.context,
      })
    })

    it('should log success messages', () => {
      const message = 'Operation successful'
      const context = { operation: 'test' }

      AnalyticsLogger.logSuccess(mockLogger, message, context)

      expect(mockLogger.log).toHaveBeenCalledWith(message, context)
    })

    it('should log success messages without context', () => {
      const message = 'Operation successful'

      AnalyticsLogger.logSuccess(mockLogger, message)

      expect(mockLogger.log).toHaveBeenCalledWith(message, undefined)
    })

    it('should log debug messages', () => {
      const message = 'Debug information'
      const context = { debug: 'data' }

      AnalyticsLogger.logDebug(mockLogger, message, context)

      expect(mockLogger.debug).toHaveBeenCalledWith(message, context)
    })

    it('should log debug messages without context', () => {
      const message = 'Debug information'

      AnalyticsLogger.logDebug(mockLogger, message)

      expect(mockLogger.debug).toHaveBeenCalledWith(message, undefined)
    })
  })
})
