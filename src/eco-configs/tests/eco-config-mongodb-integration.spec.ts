import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { DynamicConfigService } from '@/dynamic-config/services/dynamic-config.service'
import { EcoConfigService } from '../eco-config.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ModuleRef } from '@nestjs/core'
import { ModuleRefProvider } from '@/common/services/module-ref-provider'
import { Test, TestingModule } from '@nestjs/testing'

describe('EcoConfigService MongoDB Integration', () => {
  let ecoConfigService: EcoConfigService
  let dynamicConfigService: DeepMocked<DynamicConfigService>
  let eventEmitter: DeepMocked<EventEmitter2>

  const mockMongoConfigs = [
    {
      key: 'database.host',
      value: 'mongodb://localhost:27017',
      type: 'string' as const,
      isRequired: false,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'redis.port',
      value: 6380,
      type: 'number' as const,
      isRequired: false,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'api.timeout',
      value: 5000,
      type: 'number' as const,
      isRequired: false,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'feature.enabled',
      value: true,
      type: 'boolean' as const,
      isRequired: false,
      isSecret: false,
      lastModified: new Date(),
    },
  ]

  beforeEach(async () => {
    dynamicConfigService = createMock<DynamicConfigService>()
    eventEmitter = createMock<EventEmitter2>()

    dynamicConfigService.getAll.mockResolvedValue({
      data: mockMongoConfigs,
      pagination: { page: 1, limit: 100, total: 4, totalPages: 1, hasNext: false, hasPrev: false },
    })

    // Mock the prototype method before creating the instance
    jest.spyOn(EcoConfigService.prototype, 'getRpcConfig').mockReturnValue({
      config: {},
      keys: { alchemyKey: 'DummyKey' },
    })

    const mockModuleRef = {
      get: jest.fn((token) => {
        if (token === DynamicConfigService) {
          return dynamicConfigService
        }
        if (token === EventEmitter2) {
          return eventEmitter
        }
        return null
      })
    } as unknown as ModuleRef

    jest.spyOn(ModuleRefProvider, 'getModuleRef').mockReturnValue(mockModuleRef)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EcoConfigService,
          useFactory: () => {
            return new EcoConfigService([])
          },
        },
      ],
    }).compile()

    ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
  })

  describe('MongoDB Integration Enabled', () => {
    it('should load MongoDB configurations on module init', async () => {
      await ecoConfigService.onModuleInit()

      expect(dynamicConfigService.getAll).toHaveBeenCalled()
      const mongoConfigs = ecoConfigService.getMongoConfigurations()
      expect(mongoConfigs).toEqual({
        'database.host': 'mongodb://localhost:27017',
        'redis.port': 6380,
        'api.timeout': 5000,
        'feature.enabled': true,
      })
    })

    it('should subscribe to configuration changes', async () => {
      await ecoConfigService.onModuleInit()

      expect(eventEmitter.on).toHaveBeenCalledWith('configuration.changed', expect.any(Function))
    })

    it('should indicate MongoDB integration is enabled', async () => {
      await ecoConfigService.onModuleInit()

      expect(ecoConfigService.isMongoConfigurationEnabled()).toBe(true)
    })

    it('should return correct configuration sources info', async () => {
      await ecoConfigService.onModuleInit()

      const sources = ecoConfigService.getConfigurationSources()
      expect(sources).toEqual({
        external: false,
        static: true,
        mongodb: true,
        mongoConfigCount: 4,
      })
    })

    it('should prioritize MongoDB configs over static configs', async () => {
      await ecoConfigService.onModuleInit()

      // After initialization, MongoDB configs should be merged and available
      const mongoConfigs = ecoConfigService.getMongoConfigurations()
      expect(mongoConfigs['redis.port']).toBe(6380)

      // Test the getWithMongoOverride method which explicitly checks MongoDB first
      const result = ecoConfigService.getWithMongoOverride('redis.port')
      expect(result).toBe(6380)
    })

    it('should handle configuration updates reactively', async () => {
      await ecoConfigService.onModuleInit()

      // Get the callback function that was registered
      const changeCallback = (eventEmitter.on as jest.Mock).mock.calls[0][1]

      // Simulate a configuration change
      changeCallback({
        key: 'new.config',
        operation: 'UPDATE',
        newValue: 'new-value',
        timestamp: new Date(),
      })

      const mongoConfigs = ecoConfigService.getMongoConfigurations()
      expect(mongoConfigs['new.config']).toBe('new-value')
    })

    it('should update MongoDB configuration successfully', async () => {
      dynamicConfigService.update.mockResolvedValue({} as any)
      await ecoConfigService.onModuleInit()

      const result = await ecoConfigService.updateMongoConfiguration(
        'test.key',
        'test-value',
        'user123',
      )

      expect(result).toBe(true)
      expect(dynamicConfigService.update).toHaveBeenCalledWith(
        'test.key',
        { value: 'test-value' },
        'user123',
      )
    })

    it('should handle MongoDB configuration update failures', async () => {
      dynamicConfigService.update.mockRejectedValue(new Error('Update failed'))
      await ecoConfigService.onModuleInit()

      const result = await ecoConfigService.updateMongoConfiguration('test.key', 'test-value')

      expect(result).toBe(false)
    })
  })

  describe('MongoDB Integration Disabled', () => {
    beforeEach(async () => {
      // Create service without ConfigurationService
      // Mock ModuleRefProvider to return null (no ConfigurationService)
      jest.spyOn(ModuleRefProvider, 'getModuleRef').mockReturnValue({
        get: jest.fn(() => null) // Always return null
      }  as unknown as ModuleRef)

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: EcoConfigService,
            useFactory: () => {
              return new EcoConfigService([])
            },
          },
        ],
      }).compile()

      ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
    })

    it('should indicate MongoDB integration is disabled', () => {
      expect(ecoConfigService.isMongoConfigurationEnabled()).toBe(false)
    })

    it('should return empty MongoDB configurations', () => {
      expect(ecoConfigService.getMongoConfigurations()).toEqual({})
    })

    it('should return correct configuration sources info', () => {
      const sources = ecoConfigService.getConfigurationSources()
      expect(sources).toEqual({
        external: false,
        static: true,
        mongodb: false,
        mongoConfigCount: 0,
      })
    })

    it('should fail to update MongoDB configuration', async () => {
      const result = await ecoConfigService.updateMongoConfiguration('test.key', 'test-value')

      expect(result).toBe(false)
    })

    it('should work normally without MongoDB integration', async () => {
      await ecoConfigService.onModuleInit()

      // Should not throw when checking if MongoDB integration is available
      expect(() => ecoConfigService.isMongoConfigurationEnabled()).not.toThrow()
      expect(() => ecoConfigService.getMongoConfigurations()).not.toThrow()
      expect(() => ecoConfigService.getConfigurationSources()).not.toThrow()

      // MongoDB integration should be disabled
      expect(ecoConfigService.isMongoConfigurationEnabled()).toBe(false)
    })
  })

  describe('getWithMongoOverride', () => {
    beforeEach(async () => {
      await ecoConfigService.onModuleInit()
    })

    it('should return MongoDB value when available', () => {
      jest.spyOn(ecoConfigService, 'get').mockReturnValue('static-value')

      const result = ecoConfigService.getWithMongoOverride('database.host')

      expect(result).toBe('mongodb://localhost:27017')
    })

    it('should fall back to static config when MongoDB value not available', () => {
      jest.spyOn(ecoConfigService, 'get').mockReturnValue('static-value')

      const result = ecoConfigService.getWithMongoOverride('non.existent.key')

      expect(result).toBe('static-value')
    })
  })
})
