import {
  CreateConfigurationDTO,
  UpdateConfigurationDTO,
} from '@/dynamic-config/interfaces/configuration-repository.interface'
import { DynamicConfigAuditService } from '@/dynamic-config/services/dynamic-config-audit.service'
import { DynamicConfigRepository } from '@/dynamic-config/repositories/dynamic-config.repository'
import { DynamicConfigSanitizerService } from '@/dynamic-config/services/dynamic-config-sanitizer.service'
import { DynamicConfigService } from '@/dynamic-config/services/dynamic-config.service'
import { DynamicConfigValidatorService } from '@/dynamic-config/services/dynamic-config-validator.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, TestingModule } from '@nestjs/testing'

describe('DynamicConfigService', () => {
  let service: DynamicConfigService
  let repository: jest.Mocked<DynamicConfigRepository>
  let eventEmitter: jest.Mocked<EventEmitter2>
  let validator: jest.Mocked<DynamicConfigValidatorService>
  let auditService: jest.Mocked<DynamicConfigAuditService>
  let sanitizer: jest.Mocked<DynamicConfigSanitizerService>
  let mockConfigModel: any

  const mockConfigDocument = {
    _id: 'mock-id',
    key: 'test.key',
    value: 'test-value',
    type: 'string',
    isRequired: false,
    isSecret: false,
    description: 'Test config',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any

  beforeEach(async () => {
    const mockRepository = {
      findByKey: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      findRequired: jest.fn(),
      findSecrets: jest.fn(),
      findMissingRequired: jest.fn(),
      getStatistics: jest.fn(),
      healthCheck: jest.fn(),
    }

    const mockEventEmitter = {
      emit: jest.fn(),
    }

    const mockValidator = {
      registerCommonSchemas: jest.fn(),
      validateConfiguration: jest.fn(),
      validateValue: jest.fn(),
    }

    const mockAuditService = {
      handleConfigurationChange: jest.fn(),
      getConfigurationHistory: jest.fn(),
      getUserActivity: jest.fn(),
      getAuditStatistics: jest.fn(),
    }

    const mockSanitizer = {
      sanitizeValue: jest.fn((value) => value),
      validateConfigurationKey: jest.fn(() => ({ isValid: true })),
      detectSensitiveValue: jest.fn(() => false),
    }

    mockConfigModel = {
      watch: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicConfigService,
        { provide: DynamicConfigRepository, useValue: mockRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: DynamicConfigValidatorService, useValue: mockValidator },
        { provide: DynamicConfigAuditService, useValue: mockAuditService },
        { provide: DynamicConfigSanitizerService, useValue: mockSanitizer },
        { provide: 'ConfigurationModel', useValue: mockConfigModel },
      ],
    }).compile()

    service = module.get<DynamicConfigService>(DynamicConfigService)
    repository = module.get(DynamicConfigRepository)
    eventEmitter = module.get(EventEmitter2)
    validator = module.get(DynamicConfigValidatorService)
    auditService = module.get(DynamicConfigAuditService)
    sanitizer = module.get(DynamicConfigSanitizerService)

    // Mock the private timer to avoid actual intervals in tests
    jest.spyOn(service as any, 'startCacheRefreshTimer').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('onModuleInit', () => {
    it('should initialize service correctly', async () => {
      repository.findAll.mockResolvedValue({
        data: [mockConfigDocument],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      })

      await service.onModuleInit()

      expect(validator.registerCommonSchemas).toHaveBeenCalled()
      expect(repository.findAll).toHaveBeenCalled()
    })

    it('should handle initialization errors', async () => {
      repository.findAll.mockRejectedValue(new Error('Database error'))

      await expect(service.onModuleInit()).rejects.toThrow('Database error')
    })
  })

  describe('get', () => {
    it('should get configuration from cache', async () => {
      // Initialize cache first
      repository.findAll.mockResolvedValue({
        data: [mockConfigDocument],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      })
      await service.onModuleInit()

      const result = await service.get('test.key')

      expect(result).toBe('test-value')
      expect(repository.findByKey).not.toHaveBeenCalled()
    })

    it('should get configuration from database when not in cache', async () => {
      repository.findByKey.mockResolvedValue(mockConfigDocument)

      const result = await service.get('unknown.key')

      expect(repository.findByKey).toHaveBeenCalledWith('unknown.key')
      expect(result).toBe('test-value')
    })

    it('should return null for non-existent configuration', async () => {
      repository.findByKey.mockResolvedValue(null)

      const result = await service.get('nonexistent.key')

      expect(result).toBeNull()
    })

    it('should mask secret values', async () => {
      const secretConfig = { ...mockConfigDocument, isSecret: true }
      repository.findByKey.mockResolvedValue(secretConfig)

      const result = await service.get('secret.key')

      expect(result).toBe('***MASKED***')
    })
  })

  describe('getWithDefault', () => {
    it('should return configuration value when exists', async () => {
      repository.findByKey.mockResolvedValue(mockConfigDocument)

      const result = await service.getWithDefault('test.key', 'default-value')

      expect(result).toBe('test-value')
    })

    it('should return default value when configuration does not exist', async () => {
      repository.findByKey.mockResolvedValue(null)

      const result = await service.getWithDefault('nonexistent.key', 'default-value')

      expect(result).toBe('default-value')
    })
  })

  describe('create', () => {
    const createDTO: CreateConfigurationDTO = {
      key: 'new.key',
      value: 'new-value',
      type: 'string',
      description: 'New configuration',
    }

    it('should create configuration successfully', async () => {
      validator.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      })
      repository.create.mockResolvedValue(mockConfigDocument)

      const result = await service.create(createDTO, 'user123', 'Mozilla/5.0', '192.168.1.1')

      expect(validator.validateConfiguration).toHaveBeenCalledWith(createDTO.key, createDTO.value)
      expect(repository.create).toHaveBeenCalledWith(createDTO)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'configuration.changed',
        expect.objectContaining({
          key: createDTO.key,
          operation: 'CREATE',
          newValue: createDTO.value,
          userId: 'user123',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        }),
      )
      expect(result).toEqual(mockConfigDocument)
    })

    it('should throw validation error', async () => {
      validator.validateConfiguration.mockResolvedValue({
        isValid: false,
        errors: ['Invalid value'],
        warnings: [],
      })

      await expect(service.create(createDTO)).rejects.toThrow(
        'Configuration validation failed: Invalid value',
      )
    })

    it('should log warnings', async () => {
      validator.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: ['Warning message'],
      })
      repository.create.mockResolvedValue(mockConfigDocument)

      const loggerSpy = jest.spyOn((service as any).logger, 'warn')

      await service.create(createDTO)

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Warning message'))
    })

    it('should sanitize configuration values', async () => {
      const unsafeDTO = {
        key: 'test.key',
        value: '<script>alert("xss")</script>safe-value',
        type: 'string' as const,
      }

      sanitizer.sanitizeValue.mockReturnValue('safe-value')
      sanitizer.validateConfigurationKey.mockReturnValue({ isValid: true })
      validator.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      })
      repository.create.mockResolvedValue(mockConfigDocument)

      await service.create(unsafeDTO)

      expect(sanitizer.validateConfigurationKey).toHaveBeenCalledWith(unsafeDTO.key)
      expect(sanitizer.sanitizeValue).toHaveBeenCalledWith(unsafeDTO.value)
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'safe-value',
        }),
      )
    })

    it('should auto-detect sensitive values', async () => {
      const sensitiveDTO = {
        key: 'api.secret',
        value: 'sk_test_1234567890abcdef',
        type: 'string' as const,
      }

      sanitizer.detectSensitiveValue.mockReturnValue(true)
      sanitizer.validateConfigurationKey.mockReturnValue({ isValid: true })
      validator.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      })
      repository.create.mockResolvedValue(mockConfigDocument)

      await service.create(sensitiveDTO)

      expect(sanitizer.detectSensitiveValue).toHaveBeenCalledWith(
        sensitiveDTO.key,
        sensitiveDTO.value,
      )
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isSecret: true,
        }),
      )
    })

    it('should reject invalid configuration keys', async () => {
      const invalidDTO = {
        key: 'invalid key with spaces',
        value: 'test-value',
        type: 'string' as const,
      }

      sanitizer.validateConfigurationKey.mockReturnValue({
        isValid: false,
        error: 'Invalid key format',
      })

      await expect(service.create(invalidDTO)).rejects.toThrow(
        'Invalid configuration key: Invalid key format',
      )
    })
  })

  describe('update', () => {
    const updateDTO: UpdateConfigurationDTO = {
      value: 'updated-value',
      description: 'Updated configuration',
    }

    it('should update configuration successfully', async () => {
      validator.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      })
      repository.findByKey.mockResolvedValue(mockConfigDocument)
      repository.update.mockResolvedValue({ ...mockConfigDocument, ...updateDTO })

      const result = await service.update('test.key', updateDTO, 'user123')

      expect(validator.validateConfiguration).toHaveBeenCalledWith('test.key', updateDTO.value)
      expect(repository.update).toHaveBeenCalledWith('test.key', updateDTO)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'configuration.changed',
        expect.objectContaining({
          key: 'test.key',
          operation: 'UPDATE',
          oldValue: mockConfigDocument.value,
          newValue: updateDTO.value,
          userId: 'user123',
        }),
      )
      expect(result).toEqual({ ...mockConfigDocument, ...updateDTO })
    })

    it('should return null when configuration not found', async () => {
      validator.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      })
      repository.findByKey.mockResolvedValue(mockConfigDocument)
      repository.update.mockResolvedValue(null)

      const result = await service.update('nonexistent.key', updateDTO)

      expect(result).toBeNull()
    })

    it('should skip validation when value not provided', async () => {
      const updateDTONoValue = { description: 'Updated description' }
      repository.findByKey.mockResolvedValue(mockConfigDocument)
      repository.update.mockResolvedValue({ ...mockConfigDocument, ...updateDTONoValue })

      await service.update('test.key', updateDTONoValue)

      expect(validator.validateConfiguration).not.toHaveBeenCalled()
    })

    it('should sanitize updated values', async () => {
      const unsafeUpdateDTO = {
        value: '<script>alert("xss")</script>updated-value',
      }

      sanitizer.sanitizeValue.mockReturnValue('updated-value')
      validator.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      })
      repository.findByKey.mockResolvedValue(mockConfigDocument)
      repository.update.mockResolvedValue({ ...mockConfigDocument, ...unsafeUpdateDTO })

      await service.update('test.key', unsafeUpdateDTO)

      expect(sanitizer.sanitizeValue).toHaveBeenCalledWith(unsafeUpdateDTO.value)
      expect(repository.update).toHaveBeenCalledWith(
        'test.key',
        expect.objectContaining({
          value: 'updated-value',
        }),
      )
    })

    it('should auto-detect sensitive values in updates', async () => {
      const sensitiveUpdateDTO = {
        value: 'new-secret-token-12345',
      }

      sanitizer.detectSensitiveValue.mockReturnValue(true)
      validator.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      })
      repository.findByKey.mockResolvedValue(mockConfigDocument)
      repository.update.mockResolvedValue({ ...mockConfigDocument, ...sensitiveUpdateDTO })

      await service.update('test.key', sensitiveUpdateDTO)

      expect(sanitizer.detectSensitiveValue).toHaveBeenCalledWith(
        'test.key',
        sensitiveUpdateDTO.value,
      )
      expect(repository.update).toHaveBeenCalledWith(
        'test.key',
        expect.objectContaining({
          isSecret: true,
        }),
      )
    })
  })

  describe('delete', () => {
    it('should delete configuration successfully', async () => {
      repository.findByKey.mockResolvedValue(mockConfigDocument)
      repository.delete.mockResolvedValue(true)

      const result = await service.delete('test.key', 'user123')

      expect(repository.delete).toHaveBeenCalledWith('test.key')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'configuration.changed',
        expect.objectContaining({
          key: 'test.key',
          operation: 'DELETE',
          oldValue: mockConfigDocument.value,
          userId: 'user123',
        }),
      )
      expect(result).toBe(true)
    })

    it('should throw error for required configuration', async () => {
      const requiredConfig = { ...mockConfigDocument, isRequired: true }
      repository.findByKey.mockResolvedValue(requiredConfig)

      await expect(service.delete('test.key')).rejects.toThrow(
        'Cannot delete required configuration: test.key',
      )
    })

    it('should return false when configuration not found', async () => {
      repository.findByKey.mockResolvedValue(mockConfigDocument)
      repository.delete.mockResolvedValue(false)

      const result = await service.delete('nonexistent.key')

      expect(result).toBe(false)
    })
  })

  describe('utility methods', () => {
    it('should check if configuration exists', async () => {
      repository.exists.mockResolvedValue(true)

      const result = await service.exists('test.key')

      expect(repository.exists).toHaveBeenCalledWith('test.key')
      expect(result).toBe(true)
    })

    it('should get required configurations', async () => {
      repository.findRequired.mockResolvedValue([mockConfigDocument])

      const result = await service.getRequired()

      expect(repository.findRequired).toHaveBeenCalled()
      expect(result).toHaveLength(1)
    })

    it('should get secret configurations', async () => {
      repository.findSecrets.mockResolvedValue([mockConfigDocument])

      const result = await service.getSecrets()

      expect(repository.findSecrets).toHaveBeenCalled()
      expect(result).toHaveLength(1)
    })

    it('should find missing required configurations', async () => {
      repository.findMissingRequired.mockResolvedValue(['missing.key'])

      const result = await service.findMissingRequired(['test.key', 'missing.key'])

      expect(repository.findMissingRequired).toHaveBeenCalledWith(['test.key', 'missing.key'])
      expect(result).toEqual(['missing.key'])
    })

    it('should get statistics', async () => {
      const dbStats = {
        total: 10,
        byType: { string: 5, number: 3, boolean: 2 },
        required: 3,
        secrets: 2,
        lastModified: new Date(),
      }
      repository.getStatistics.mockResolvedValue(dbStats)

      const result = await service.getStatistics()

      expect(result).toEqual({
        ...dbStats,
        cache: expect.objectContaining({
          size: expect.any(Number),
          initialized: expect.any(Boolean),
        }),
      })
    })
  })

  describe('cache management', () => {
    it('should refresh cache', async () => {
      repository.findAll.mockResolvedValue({
        data: [mockConfigDocument],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      })

      await service.refreshCache()

      expect(repository.findAll).toHaveBeenCalled()
    })

    it('should clear cache', () => {
      service.clearCache()

      const metrics = service.getCacheMetrics()
      expect(metrics.size).toBe(0)
      expect(metrics.initialized).toBe(false)
    })

    it('should get cache metrics', () => {
      const metrics = service.getCacheMetrics()

      expect(metrics).toEqual({
        size: expect.any(Number),
        initialized: expect.any(Boolean),
        keys: expect.any(Array),
        memoryUsage: expect.any(Object),
      })
    })
  })

  describe('health check', () => {
    it('should return true when healthy', async () => {
      repository.healthCheck.mockResolvedValue(true)
      // Initialize cache to make it healthy
      repository.findAll.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      })
      await service.onModuleInit()

      const result = await service.healthCheck()

      expect(result).toBe(true)
    })

    it('should return false when repository unhealthy', async () => {
      repository.healthCheck.mockResolvedValue(false)

      const result = await service.healthCheck()

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      repository.healthCheck.mockRejectedValue(new Error('Health check error'))

      const result = await service.healthCheck()

      expect(result).toBe(false)
    })
  })

  describe('audit integration', () => {
    it('should get audit history', async () => {
      const mockHistory = [{ configKey: 'test.key', operation: 'CREATE' }]
      auditService.getConfigurationHistory.mockResolvedValue(mockHistory as any)

      const result = await service.getAuditHistory('test.key', 10, 5)

      expect(auditService.getConfigurationHistory).toHaveBeenCalledWith('test.key', 10, 5)
      expect(result).toEqual(mockHistory)
    })

    it('should get user activity', async () => {
      const mockActivity = [{ userId: 'user123', operation: 'UPDATE' }]
      auditService.getUserActivity.mockResolvedValue(mockActivity as any)

      const result = await service.getUserActivity('user123', 20, 10)

      expect(auditService.getUserActivity).toHaveBeenCalledWith('user123', 20, 10)
      expect(result).toEqual(mockActivity)
    })

    it('should get audit statistics', async () => {
      const mockStats = { totalOperations: 100, operationCounts: {} }
      auditService.getAuditStatistics.mockResolvedValue(mockStats as any)

      const startDate = new Date('2023-01-01')
      const endDate = new Date('2023-12-31')
      const result = await service.getAuditStatistics(startDate, endDate)

      expect(auditService.getAuditStatistics).toHaveBeenCalledWith(startDate, endDate)
      expect(result).toEqual(mockStats)
    })
  })

  describe('validation', () => {
    it('should validate configuration value', async () => {
      validator.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: ['Warning'],
      })

      const result = await service.validateValue('test.key', 'test-value')

      expect(validator.validateConfiguration).toHaveBeenCalledWith('test.key', 'test-value')
      expect(result).toEqual({
        isValid: true,
        errors: [],
        warnings: ['Warning'],
      })
    })
  })

  describe('MongoDB Change Streams', () => {
    let mockChangeStream: any

    beforeEach(() => {
      mockChangeStream = {
        on: jest.fn(),
        close: jest.fn(),
      }
    })

    describe('startChangeStreamMonitoring', () => {
      it('should start change stream monitoring successfully', async () => {
        mockConfigModel.watch.mockReturnValue(mockChangeStream)

        // Initialize service to trigger change stream setup
        repository.findAll.mockResolvedValue({
          data: [mockConfigDocument],
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        })

        await service.onModuleInit()

        expect(mockConfigModel.watch).toHaveBeenCalledWith(
          [
            {
              $match: {
                'fullDocument.key': { $exists: true },
                operationType: { $in: ['insert', 'update', 'delete'] },
              },
            },
          ],
          {
            fullDocument: 'updateLookup',
            fullDocumentBeforeChange: 'whenAvailable',
          },
        )

        expect(mockChangeStream.on).toHaveBeenCalledWith('change', expect.any(Function))
        expect(mockChangeStream.on).toHaveBeenCalledWith('error', expect.any(Function))
        expect(mockChangeStream.on).toHaveBeenCalledWith('close', expect.any(Function))
      })

      it('should handle change stream initialization errors', async () => {
        mockConfigModel.watch.mockImplementation(() => {
          throw new Error('Change stream failed')
        })

        repository.findAll.mockResolvedValue({
          data: [mockConfigDocument],
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        })

        // Should not throw, but log error and continue
        await expect(service.onModuleInit()).resolves.not.toThrow()

        // Should fall back to polling mode
        const status = service.getServiceStatus()
        expect(status.changeStreamsActive).toBe(false)
        expect(status.mode).toBe('hybrid')
      })
    })

    describe('handleChangeStreamEvent', () => {
      beforeEach(async () => {
        mockConfigModel.watch.mockReturnValue(mockChangeStream)

        repository.findAll.mockResolvedValue({
          data: [mockConfigDocument],
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        })

        await service.onModuleInit()
      })

      it('should handle insert change events', () => {
        const changeEvent = {
          operationType: 'insert',
          fullDocument: {
            key: 'new.config',
            value: 'new-value',
          },
          fullDocumentBeforeChange: null,
        }

        // Get the change handler that was registered
        const changeHandler = mockChangeStream.on.mock.calls.find((call) => call[0] === 'change')[1]

        changeHandler(changeEvent)

        // Should emit configuration change event
        expect(eventEmitter.emit).toHaveBeenCalledWith('configuration.changed', {
          key: 'new.config',
          operation: 'INSERT',
          newValue: 'new-value',
          oldValue: undefined,
          timestamp: expect.any(Date),
          userId: 'change-stream',
        })
      })

      it('should handle update change events', () => {
        const changeEvent = {
          operationType: 'update',
          fullDocument: {
            key: 'test.key',
            value: 'updated-value',
          },
          fullDocumentBeforeChange: {
            key: 'test.key',
            value: 'old-value',
          },
        }

        const changeHandler = mockChangeStream.on.mock.calls.find((call) => call[0] === 'change')[1]

        changeHandler(changeEvent)

        expect(eventEmitter.emit).toHaveBeenCalledWith('configuration.changed', {
          key: 'test.key',
          operation: 'UPDATE',
          newValue: 'updated-value',
          oldValue: 'old-value',
          timestamp: expect.any(Date),
          userId: 'change-stream',
        })
      })

      it('should handle delete change events', () => {
        const changeEvent = {
          operationType: 'delete',
          fullDocument: null,
          fullDocumentBeforeChange: {
            key: 'deleted.key',
            value: 'deleted-value',
          },
        }

        const changeHandler = mockChangeStream.on.mock.calls.find((call) => call[0] === 'change')[1]

        changeHandler(changeEvent)

        expect(eventEmitter.emit).toHaveBeenCalledWith('configuration.changed', {
          key: 'deleted.key',
          operation: 'DELETE',
          newValue: undefined,
          oldValue: 'deleted-value',
          timestamp: expect.any(Date),
          userId: 'change-stream',
        })
      })

      it('should handle change events with missing key gracefully', () => {
        const changeEvent = {
          operationType: 'update',
          fullDocument: {
            // Missing key property
            value: 'some-value',
          },
          fullDocumentBeforeChange: null,
        }

        const changeHandler = mockChangeStream.on.mock.calls.find((call) => call[0] === 'change')[1]

        // Should not throw
        expect(() => changeHandler(changeEvent)).not.toThrow()

        // Should not emit event for invalid change
        expect(eventEmitter.emit).not.toHaveBeenCalledWith(
          'configuration.changed',
          expect.any(Object),
        )
      })
    })

    describe('handleChangeStreamError', () => {
      beforeEach(async () => {
        mockConfigModel.watch.mockReturnValue(mockChangeStream)

        repository.findAll.mockResolvedValue({
          data: [mockConfigDocument],
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        })

        await service.onModuleInit()
      })

      it('should handle change stream errors and attempt reconnection', async () => {
        // Mock timers to control setTimeout behavior
        jest.useFakeTimers()

        const error = new Error('Connection lost')

        // Get the error handler that was registered
        const errorHandler = mockChangeStream.on.mock.calls.find((call) => call[0] === 'error')[1]

        // Reset the mock to track reconnection calls
        mockConfigModel.watch.mockClear()
        mockConfigModel.watch.mockReturnValue(mockChangeStream)

        errorHandler(error)

        // Should close the existing change stream
        expect(mockChangeStream.close).toHaveBeenCalled()

        // Should mark change streams as inactive
        const status = service.getServiceStatus()
        expect(status.changeStreamsActive).toBe(false)

        // Fast-forward time to trigger reconnection
        jest.advanceTimersByTime(5000)

        // Should attempt reconnection
        expect(mockConfigModel.watch).toHaveBeenCalledTimes(1) // Reconnection attempt

        // Restore real timers
        jest.useRealTimers()
      })
    })

    describe('cache synchronization', () => {
      beforeEach(async () => {
        mockConfigModel.watch.mockReturnValue(mockChangeStream)

        repository.findAll.mockResolvedValue({
          data: [mockConfigDocument],
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        })

        await service.onModuleInit()
      })

      it('should update cache when configuration is created via change stream', async () => {
        const changeEvent = {
          operationType: 'insert',
          fullDocument: {
            key: 'cache.test',
            value: 'cache-value',
          },
        }

        const changeHandler = mockChangeStream.on.mock.calls.find((call) => call[0] === 'change')[1]

        changeHandler(changeEvent)

        // Configuration should now be available from cache
        const result = await service.get('cache.test')
        expect(result).toBe('cache-value')
      })

      it('should update cache when configuration is updated via change stream', async () => {
        // First, ensure the config is in cache
        await service.get('test.key') // This will cache it

        const changeEvent = {
          operationType: 'update',
          fullDocument: {
            key: 'test.key',
            value: 'updated-from-stream',
          },
          fullDocumentBeforeChange: {
            key: 'test.key',
            value: 'old-value',
          },
        }

        const changeHandler = mockChangeStream.on.mock.calls.find((call) => call[0] === 'change')[1]

        changeHandler(changeEvent)

        // Cache should be updated
        const result = await service.get('test.key')
        expect(result).toBe('updated-from-stream')
      })

      it('should remove from cache when configuration is deleted via change stream', async () => {
        // First, ensure the config is in cache
        await service.get('test.key')

        const changeEvent = {
          operationType: 'delete',
          fullDocumentBeforeChange: {
            key: 'test.key',
            value: 'deleted-value',
          },
        }

        const changeHandler = mockChangeStream.on.mock.calls.find((call) => call[0] === 'change')[1]

        changeHandler(changeEvent)

        // Configuration should no longer be in cache
        repository.findByKey.mockResolvedValue(null)
        const result = await service.get('test.key')
        expect(result).toBeNull()
      })
    })

    describe('service status', () => {
      it('should report correct status when change streams are active', async () => {
        mockConfigModel.watch.mockReturnValue(mockChangeStream)

        repository.findAll.mockResolvedValue({
          data: [mockConfigDocument],
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        })

        await service.onModuleInit()

        const status = service.getServiceStatus()
        expect(status.changeStreamsEnabled).toBe(true)
        expect(status.changeStreamsActive).toBe(true)
        expect(status.mode).toBe('real-time')
        expect(status.cacheRefreshInterval).toBe(30 * 60 * 1000) // 30 minutes
      })

      it('should report correct status when change streams fail', async () => {
        mockConfigModel.watch.mockImplementation(() => {
          throw new Error('Change stream failed')
        })

        repository.findAll.mockResolvedValue({
          data: [mockConfigDocument],
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        })

        await service.onModuleInit()

        const status = service.getServiceStatus()
        expect(status.changeStreamsEnabled).toBe(true)
        expect(status.changeStreamsActive).toBe(false)
        expect(status.mode).toBe('hybrid')
        expect(status.cacheRefreshInterval).toBe(5 * 60 * 1000) // 5 minutes
      })

      it('should report polling mode when change streams are disabled', async () => {
        // Temporarily disable change streams
        process.env.MONGODB_CHANGE_STREAMS_ENABLED = 'false'

        // Create a new service instance with change streams disabled
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            DynamicConfigService,
            { provide: DynamicConfigRepository, useValue: repository },
            { provide: EventEmitter2, useValue: eventEmitter },
            { provide: DynamicConfigValidatorService, useValue: validator },
            { provide: DynamicConfigAuditService, useValue: auditService },
            { provide: DynamicConfigSanitizerService, useValue: sanitizer },
            { provide: 'ConfigurationModel', useValue: { watch: jest.fn() } },
          ],
        }).compile()

        const disabledService = module.get<DynamicConfigService>(DynamicConfigService)
        jest.spyOn(disabledService as any, 'startCacheRefreshTimer').mockImplementation(() => {})

        repository.findAll.mockResolvedValue({
          data: [mockConfigDocument],
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        })

        await disabledService.onModuleInit()

        const status = disabledService.getServiceStatus()
        expect(status.changeStreamsEnabled).toBe(false)
        expect(status.changeStreamsActive).toBe(false)
        expect(status.mode).toBe('polling')

        // Restore environment variable
        delete process.env.MONGODB_CHANGE_STREAMS_ENABLED
      })
    })

    describe('multi-instance synchronization', () => {
      it('should emit events that can be consumed by other services', async () => {
        mockConfigModel.watch.mockReturnValue(mockChangeStream)

        repository.findAll.mockResolvedValue({
          data: [mockConfigDocument],
          pagination: {
            page: 1,
            limit: 50,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        })

        await service.onModuleInit()

        const changeEvent = {
          operationType: 'update',
          fullDocument: {
            key: 'multi.instance.test',
            value: 'synchronized-value',
          },
          fullDocumentBeforeChange: {
            key: 'multi.instance.test',
            value: 'old-value',
          },
        }

        const changeHandler = mockChangeStream.on.mock.calls.find((call) => call[0] === 'change')[1]

        changeHandler(changeEvent)

        // Should emit event that EcoConfigService can listen to
        expect(eventEmitter.emit).toHaveBeenCalledWith('configuration.changed', {
          key: 'multi.instance.test',
          operation: 'UPDATE',
          newValue: 'synchronized-value',
          oldValue: 'old-value',
          timestamp: expect.any(Date),
          userId: 'change-stream',
        })
      })
    })
  })
})
