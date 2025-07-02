import { PosthogService } from '@/analytics/posthog.service'
import { AnalyticsConfig } from '@/analytics/analytics.interface'
import { AnalyticsError } from '@/analytics/errors'
import { PostHog } from 'posthog-node'

// Mock PostHog
jest.mock('posthog-node')
const MockedPostHog = PostHog as jest.MockedClass<typeof PostHog>

describe('PosthogService', () => {
  let service: PosthogService
  let mockPostHogClient: jest.Mocked<PostHog>
  let consoleErrorSpy: jest.SpyInstance
  let consoleLogSpy: jest.SpyInstance

  const mockConfig: AnalyticsConfig = {
    apiKey: 'test-api-key',
    host: 'https://test.posthog.com',
    flushAt: 5,
    flushInterval: 1000,
    groups: {
      environment: 'test',
      service: 'eco-solver',
    },
  }

  beforeEach(() => {
    // Mock console methods to avoid noise in tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

    // Create mock PostHog client
    mockPostHogClient = {
      capture: jest.fn(),
      isFeatureEnabled: jest.fn(),
      getFeatureFlag: jest.fn(),
      getAllFlags: jest.fn(),
      groupIdentify: jest.fn(),
      flush: jest.fn(),
      shutdown: jest.fn(),
    } as any

    // Mock PostHog constructor
    MockedPostHog.mockImplementation(() => mockPostHogClient)

    service = new PosthogService(mockConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  describe('constructor', () => {
    it('should throw AnalyticsError if API key is missing', () => {
      expect(() => new PosthogService({})).toThrow(AnalyticsError)
      expect(() => new PosthogService({})).toThrow('PostHog API key is required')
    })

    it('should initialize with correct configuration', () => {
      expect(MockedPostHog).toHaveBeenCalledWith(
        'test-api-key',
        expect.objectContaining({
          host: 'https://test.posthog.com',
          flushAt: 5,
          flushInterval: 1000,
        }),
      )
    })

    it('should use default configuration when not provided', () => {
      new PosthogService({ apiKey: 'test-key' })
      expect(MockedPostHog).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          host: 'https://us.posthog.com',
          flushAt: 20,
          flushInterval: 10000,
        }),
      )
    })

    it('should initialize groups on construction', () => {
      expect(mockPostHogClient.groupIdentify).toHaveBeenCalledWith({
        groupType: 'environment',
        groupKey: 'test',
        properties: expect.objectContaining({
          service: 'eco-solver',
        }),
      })
      expect(mockPostHogClient.groupIdentify).toHaveBeenCalledWith({
        groupType: 'service',
        groupKey: 'eco-solver',
        properties: expect.objectContaining({
          service: 'eco-solver',
        }),
      })
    })
  })

  describe('capture', () => {
    it('should capture events with timestamp', async () => {
      await service.capture('user123', 'test_event', { key: 'value' })

      expect(mockPostHogClient.capture).toHaveBeenCalledWith({
        distinctId: 'user123',
        event: 'test_event',
        properties: {
          key: 'value',
          timestamp: expect.any(Date),
        },
      })
    })

    it('should handle capture errors', async () => {
      const error = new Error('Capture failed')
      mockPostHogClient.capture.mockImplementation(() => {
        throw error
      })

      await expect(service.capture('user123', 'test_event')).rejects.toThrow(AnalyticsError)
      await expect(service.capture('user123', 'test_event')).rejects.toThrow(
        'Failed to capture event test_event for user user123',
      )
    })
  })

  describe('trackEvent', () => {
    it('should use userId from properties as distinctId', async () => {
      await service.trackEvent('test_event', { userId: 'user123', key: 'value' })

      expect(mockPostHogClient.capture).toHaveBeenCalledWith({
        distinctId: 'user123',
        event: 'test_event',
        properties: {
          userId: 'user123',
          key: 'value',
          timestamp: expect.any(Date),
        },
      })
    })

    it('should use distinctId from properties if provided', async () => {
      await service.trackEvent('test_event', { distinctId: 'custom123', key: 'value' })

      expect(mockPostHogClient.capture).toHaveBeenCalledWith({
        distinctId: 'custom123',
        event: 'test_event',
        properties: {
          distinctId: 'custom123',
          key: 'value',
          timestamp: expect.any(Date),
        },
      })
    })

    it('should use backend-service as default distinctId', async () => {
      await service.trackEvent('test_event', { key: 'value' })

      expect(mockPostHogClient.capture).toHaveBeenCalledWith({
        distinctId: 'backend-service',
        event: 'test_event',
        properties: {
          key: 'value',
          timestamp: expect.any(Date),
        },
      })
    })
  })

  describe('isFeatureEnabled', () => {
    it('should check feature flag with merged groups', async () => {
      mockPostHogClient.isFeatureEnabled.mockResolvedValue(true)

      const result = await service.isFeatureEnabled('test_flag', 'user123', { team: 'engineering' })

      expect(mockPostHogClient.isFeatureEnabled).toHaveBeenCalledWith('test_flag', 'user123', {
        environment: 'test',
        service: 'eco-solver',
        team: 'engineering',
      })
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockPostHogClient.isFeatureEnabled.mockRejectedValue(new Error('Flag check failed'))

      const result = await service.isFeatureEnabled('test_flag', 'user123')

      expect(result).toBe(false)
    })

    it('should convert truthy values to boolean', async () => {
      mockPostHogClient.isFeatureEnabled.mockResolvedValue('true' as any)

      const result = await service.isFeatureEnabled('test_flag', 'user123')

      expect(result).toBe(true)
    })
  })

  describe('getFeatureFlag', () => {
    it('should get feature flag value with merged groups', async () => {
      mockPostHogClient.getFeatureFlag.mockResolvedValue('variant_a')

      const result = await service.getFeatureFlag('test_flag', 'user123', { team: 'engineering' })

      expect(mockPostHogClient.getFeatureFlag).toHaveBeenCalledWith('test_flag', 'user123', {
        environment: 'test',
        service: 'eco-solver',
        team: 'engineering',
      })
      expect(result).toBe('variant_a')
    })

    it('should return undefined on error', async () => {
      mockPostHogClient.getFeatureFlag.mockRejectedValue(new Error('Flag get failed'))

      const result = await service.getFeatureFlag('test_flag', 'user123')

      expect(result).toBeUndefined()
    })
  })

  describe('getAllFlags', () => {
    it('should get all flags with merged groups', async () => {
      const mockFlags = { flag1: true, flag2: 'variant_b' }
      mockPostHogClient.getAllFlags.mockResolvedValue(mockFlags)

      const result = await service.getAllFlags('user123', { team: 'engineering' })

      expect(mockPostHogClient.getAllFlags).toHaveBeenCalledWith('user123', {
        environment: 'test',
        service: 'eco-solver',
        team: 'engineering',
      })
      expect(result).toEqual(mockFlags)
    })

    it('should return empty object on error', async () => {
      mockPostHogClient.getAllFlags.mockRejectedValue(new Error('Get all flags failed'))

      const result = await service.getAllFlags('user123')

      expect(result).toEqual({})
    })

    it('should return empty object if client returns null', async () => {
      mockPostHogClient.getAllFlags.mockResolvedValue(null as any)

      const result = await service.getAllFlags('user123')

      expect(result).toEqual({})
    })
  })

  describe('groupIdentify', () => {
    it('should identify groups with properties', async () => {
      await service.groupIdentify('team', 'engineering', { members: 5 })

      expect(mockPostHogClient.groupIdentify).toHaveBeenCalledWith({
        groupType: 'team',
        groupKey: 'engineering',
        properties: { members: 5 },
      })
    })

    it('should throw error on failure', async () => {
      const error = new Error('Group identify failed')
      mockPostHogClient.groupIdentify.mockImplementation(() => {
        throw error
      })

      await expect(service.groupIdentify('team', 'engineering')).rejects.toThrow(AnalyticsError)
      await expect(service.groupIdentify('team', 'engineering')).rejects.toThrow(
        'Failed to identify group team:engineering',
      )
    })
  })

  describe('flush', () => {
    it('should flush events successfully', async () => {
      mockPostHogClient.flush.mockResolvedValue(undefined)

      await service.flush()

      expect(mockPostHogClient.flush).toHaveBeenCalled()
    })

    it('should throw error on flush failure', async () => {
      const error = new Error('Flush failed')
      mockPostHogClient.flush.mockRejectedValue(error)

      await expect(service.flush()).rejects.toThrow(AnalyticsError)
      await expect(service.flush()).rejects.toThrow('Failed to flush PostHog events')
    })
  })

  describe('shutdown', () => {
    it('should shutdown successfully', async () => {
      mockPostHogClient.shutdown.mockResolvedValue(undefined)

      await service.shutdown()

      expect(mockPostHogClient.shutdown).toHaveBeenCalled()
    })

    it('should throw error on shutdown failure', async () => {
      const error = new Error('Shutdown failed')
      mockPostHogClient.shutdown.mockRejectedValue(error)

      await expect(service.shutdown()).rejects.toThrow(AnalyticsError)
      await expect(service.shutdown()).rejects.toThrow('Failed to shutdown PostHog service')
    })
  })

  describe('onModuleDestroy', () => {
    it('should call shutdown when module is destroyed', async () => {
      const shutdownSpy = jest.spyOn(service, 'shutdown').mockResolvedValue()

      await service.onModuleDestroy()

      expect(shutdownSpy).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle configuration errors gracefully', () => {
      const configWithError = {
        ...mockConfig,
        onError: jest.fn(),
      }

      new PosthogService(configWithError)

      expect(MockedPostHog).toHaveBeenCalledWith(
        'test-api-key',
        expect.objectContaining({
          onError: configWithError.onError,
        }),
      )
    })

    it('should use default error handler when none provided', () => {
      const configWithoutError = { apiKey: 'test-key' }
      new PosthogService(configWithoutError)

      expect(MockedPostHog).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          onError: expect.any(Function),
        }),
      )
    })
  })
})
