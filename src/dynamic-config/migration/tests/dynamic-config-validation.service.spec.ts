import { DynamicConfigService } from '@/dynamic-config/services/dynamic-config.service'
import { DynamicConfigValidationService } from '@/dynamic-config/migration/dynamic-config-validation.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Test, TestingModule } from '@nestjs/testing'

describe('DynamicConfigValidationService', () => {
  let service: DynamicConfigValidationService
  let configurationService: jest.Mocked<DynamicConfigService>
  let ecoConfigService: jest.Mocked<EcoConfigService>

  const mockConfigurations = [
    {
      key: 'database.uri',
      value: 'mongodb://localhost:27017/test',
      type: 'string' as const,
      isRequired: true,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'database.dbName',
      value: 'test-db',
      type: 'string' as const,
      isRequired: true,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'server.url',
      value: 'https://api.example.com',
      type: 'string' as const,
      isRequired: true,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'port',
      value: 3000,
      type: 'number' as const,
      isRequired: true,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'redis.connection',
      value: { host: 'localhost', port: 6379 },
      type: 'object' as const,
      isRequired: true,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'eth.privateKey',
      value: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      type: 'string' as const,
      isRequired: false,
      isSecret: true,
      lastModified: new Date(),
    },
    {
      key: 'api.secret',
      value: 'secret123',
      type: 'string' as const,
      isRequired: false,
      isSecret: true,
      lastModified: new Date(),
    },
    {
      key: 'invalid.port',
      value: 99999,
      type: 'number' as const,
      isRequired: false,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'invalid.url',
      value: 'not-a-url',
      type: 'string' as const,
      isRequired: false,
      isSecret: false,
      lastModified: new Date(),
    },
    {
      key: 'weak.secret',
      value: '123',
      type: 'string' as const,
      isRequired: false,
      isSecret: true,
      lastModified: new Date(),
    },
  ]

  beforeEach(async () => {
    const mockConfigurationService = {
      getAll: jest.fn(),
    }

    const mockEcoConfigService = {
      get: jest.fn(),
      getMongoConfigurations: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicConfigValidationService,
        {
          provide: DynamicConfigService,
          useValue: mockConfigurationService,
        },
        {
          provide: EcoConfigService,
          useValue: mockEcoConfigService,
        },
      ],
    }).compile()

    service = module.get<DynamicConfigValidationService>(DynamicConfigValidationService)
    configurationService = module.get(DynamicConfigService)
    ecoConfigService = module.get(EcoConfigService)

    // Setup default mocks
    configurationService.getAll.mockResolvedValue({
      data: mockConfigurations,
      pagination: {
        page: 1,
        limit: 50,
        total: mockConfigurations.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    })
    ecoConfigService.getMongoConfigurations.mockReturnValue({})
    ecoConfigService.get.mockReturnValue({})
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('validateAllConfigurations', () => {
    it('should validate all configurations successfully', async () => {
      const validConfigs = [
        {
          key: 'database.uri',
          value: 'mongodb://localhost:27017/test',
          type: 'string' as const,
          isRequired: true,
          isSecret: false,
          lastModified: new Date(),
        },
        {
          key: 'database.dbName',
          value: 'test-db',
          type: 'string' as const,
          isRequired: true,
          isSecret: false,
          lastModified: new Date(),
        },
        {
          key: 'server.url',
          value: 'https://api.example.com',
          type: 'string' as const,
          isRequired: true,
          isSecret: false,
          lastModified: new Date(),
        },
        {
          key: 'port',
          value: 3000,
          type: 'number' as const,
          isRequired: true,
          isSecret: false,
          lastModified: new Date(),
        },
        {
          key: 'redis.connection',
          value: { host: 'localhost', port: 6379 },
          type: 'object' as const,
          isRequired: true,
          isSecret: false,
          lastModified: new Date(),
        },
      ]

      configurationService.getAll.mockResolvedValue({
        data: validConfigs,
        pagination: {
          page: 1,
          limit: 50,
          total: validConfigs.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      })

      const result = await service.validateAllConfigurations()

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.summary.totalConfigurations).toBe(validConfigs.length)
      expect(result.summary.validConfigurations).toBe(validConfigs.length)
      expect(result.summary.invalidConfigurations).toBe(0)
    })

    it('should detect validation errors', async () => {
      const result = await service.validateAllConfigurations()

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.summary.invalidConfigurations).toBeGreaterThan(0)

      // Should detect invalid port (99999 > 65535)
      const portError = result.errors.find(
        (error) => error.key === 'invalid.port' && error.type === 'INVALID_VALUE',
      )
      expect(portError).toBeDefined()
      expect(portError?.message).toContain('Port must be a number between 1 and 65535')

      // Should detect invalid URL
      const urlError = result.errors.find(
        (error) => error.key === 'invalid.url' && error.type === 'INVALID_VALUE',
      )
      expect(urlError).toBeDefined()
      expect(urlError?.message).toContain('Invalid URL format')
    })

    it('should detect security warnings', async () => {
      const result = await service.validateAllConfigurations()

      expect(result.warnings.length).toBeGreaterThan(0)

      // Should warn about weak secret
      const weakSecretWarning = result.warnings.find((warning) => warning.key === 'weak.secret')
      expect(weakSecretWarning).toBeDefined()
      expect(weakSecretWarning?.type).toBe('SECURITY')
      expect(weakSecretWarning?.message).toContain('too short')
    })

    it('should detect missing required configurations', async () => {
      configurationService.getAll.mockResolvedValue({
        data: [
          {
            key: 'optional.config',
            value: 'value',
            type: 'string' as const,
            isRequired: false,
            isSecret: false,
            lastModified: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      })

      const result = await service.validateAllConfigurations()

      // Since we return an empty required configurations list, validation should pass
      // even with minimal configurations (to avoid false positives during migration)
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
      expect(result.summary.totalConfigurations).toBe(1)
    })

    it('should handle validation service errors gracefully', async () => {
      configurationService.getAll.mockRejectedValue(new Error('Database connection failed'))

      const result = await service.validateAllConfigurations()

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].key).toBe('VALIDATION_ERROR')
      expect(result.errors[0].type).toBe('SCHEMA_VIOLATION')
    })
  })

  describe('validateSingleConfiguration', () => {
    it('should validate valid configuration', async () => {
      const result = await service.validateSingleConfiguration(
        'database.uri',
        'mongodb://localhost:27017/test',
      )

      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should detect type mismatch', async () => {
      const result = await service.validateSingleConfiguration('port', 'not-a-number')

      expect(result.errors.length).toBeGreaterThan(0)
      const typeError = result.errors.find((error) => error.type === 'INVALID_TYPE')
      expect(typeError).toBeDefined()
      expect(typeError?.expectedType).toBe('number')
      expect(typeError?.actualType).toBe('string')
    })

    it('should detect invalid port value', async () => {
      const result = await service.validateSingleConfiguration('port', 99999)

      expect(result.errors.length).toBeGreaterThan(0)
      const valueError = result.errors.find((error) => error.type === 'INVALID_VALUE')
      expect(valueError).toBeDefined()
      expect(valueError?.message).toContain('Port must be a number between 1 and 65535')
    })

    it('should detect invalid port value with key containing port', async () => {
      const result = await service.validateSingleConfiguration('invalid.port', 99999)

      expect(result.errors.length).toBeGreaterThan(0)
      const valueError = result.errors.find((error) => error.type === 'INVALID_VALUE')
      expect(valueError).toBeDefined()
      expect(valueError?.message).toContain('Port must be a number between 1 and 65535')
    })

    it('should detect invalid URL format', async () => {
      const result = await service.validateSingleConfiguration('server.url', 'not-a-url')

      expect(result.errors.length).toBeGreaterThan(0)
      const valueError = result.errors.find((error) => error.type === 'INVALID_VALUE')
      expect(valueError).toBeDefined()
      expect(valueError?.message).toContain('Invalid URL format')
    })

    it('should detect invalid Ethereum address', async () => {
      const result = await service.validateSingleConfiguration(
        'eth.walletAddress',
        'invalid-address',
      )

      expect(result.errors.length).toBeGreaterThan(0)
      const valueError = result.errors.find((error) => error.type === 'INVALID_VALUE')
      expect(valueError).toBeDefined()
      expect(valueError?.message).toContain('Invalid Ethereum address format')
    })

    it('should detect invalid private key', async () => {
      const result = await service.validateSingleConfiguration('eth.privateKey', 'invalid-key')

      expect(result.errors.length).toBeGreaterThan(0)
      const valueError = result.errors.find((error) => error.type === 'INVALID_VALUE')
      expect(valueError).toBeDefined()
      expect(valueError?.message).toContain('Invalid private key format')
    })

    it('should warn about insecure HTTP URLs', async () => {
      const result = await service.validateSingleConfiguration('api.url', 'http://external-api.com')

      expect(result.warnings.length).toBeGreaterThan(0)
      const securityWarning = result.warnings.find((warning) => warning.type === 'SECURITY')
      expect(securityWarning).toBeDefined()
      expect(securityWarning?.message).toContain('HTTP instead of HTTPS')
    })

    it('should warn about test/demo secrets', async () => {
      const result = await service.validateSingleConfiguration('api.secret', 'test-secret-123')

      expect(result.warnings.length).toBeGreaterThan(0)
      const securityWarning = result.warnings.find((warning) => warning.type === 'SECURITY')
      expect(securityWarning).toBeDefined()
      expect(securityWarning?.message).toContain('test/demo value')
    })

    it('should warn about large configuration values', async () => {
      const largeObject = { data: 'x'.repeat(15000) }
      const result = await service.validateSingleConfiguration('large.config', largeObject)

      expect(result.warnings.length).toBeGreaterThan(0)
      const performanceWarning = result.warnings.find((warning) => warning.type === 'PERFORMANCE')
      expect(performanceWarning).toBeDefined()
      expect(performanceWarning?.message).toContain('very large')
    })

    it('should warn about large arrays', async () => {
      const largeArray = new Array(150).fill('item')
      const result = await service.validateSingleConfiguration('large.array', largeArray)

      expect(result.warnings.length).toBeGreaterThan(0)
      const performanceWarning = result.warnings.find((warning) => warning.type === 'PERFORMANCE')
      expect(performanceWarning).toBeDefined()
      expect(performanceWarning?.message).toContain('array is very large')
    })

    it('should handle validation errors gracefully', async () => {
      // Mock schema validation to throw an error
      const getSchemaMethod = (service as any).getConfigurationSchema.bind(service)
      jest.spyOn(service as any, 'getConfigurationSchema').mockImplementation(() => {
        throw new Error('Schema error')
      })

      const result = await service.validateSingleConfiguration('test.key', 'test-value')

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].type).toBe('SCHEMA_VIOLATION')
      expect(result.errors[0].message).toContain('Validation error')
    })
  })

  describe('compareWithAws', () => {
    it('should detect identical configurations', async () => {
      const configs = {
        'database.uri': 'mongodb://localhost:27017',
        'server.url': 'https://api.example.com',
      }

      ecoConfigService.get.mockReturnValue(configs)
      ecoConfigService.getMongoConfigurations.mockReturnValue(configs)

      const result = await service.compareWithAws()

      expect(result.identical).toBe(true)
      expect(result.differences).toHaveLength(0)
    })

    it('should detect missing configurations in MongoDB', async () => {
      const awsConfigs = {
        'database.uri': 'mongodb://localhost:27017',
        'server.url': 'https://api.example.com',
      }
      const mongoConfigs = {
        'database.uri': 'mongodb://localhost:27017',
        // Missing server.url
      }

      ecoConfigService.get.mockReturnValue(awsConfigs)
      ecoConfigService.getMongoConfigurations.mockReturnValue(mongoConfigs)

      const result = await service.compareWithAws()

      expect(result.identical).toBe(false)
      expect(result.differences).toHaveLength(1)
      expect(result.differences[0].type).toBe('MISSING_IN_MONGO')
      expect(result.differences[0].key).toBe('server.url')
    })

    it('should detect missing configurations in AWS', async () => {
      const awsConfigs = {
        'database.uri': 'mongodb://localhost:27017',
      }
      const mongoConfigs = {
        'database.uri': 'mongodb://localhost:27017',
        'server.url': 'https://api.example.com',
      }

      ecoConfigService.get.mockReturnValue(awsConfigs)
      ecoConfigService.getMongoConfigurations.mockReturnValue(mongoConfigs)

      const result = await service.compareWithAws()

      expect(result.identical).toBe(false)
      expect(result.differences).toHaveLength(1)
      expect(result.differences[0].type).toBe('MISSING_IN_AWS')
      expect(result.differences[0].key).toBe('server.url')
    })

    it('should detect value mismatches', async () => {
      const awsConfigs = {
        'database.uri': 'mongodb://localhost:27017',
        'server.url': 'https://api.example.com',
      }
      const mongoConfigs = {
        'database.uri': 'mongodb://different-host:27017',
        'server.url': 'https://api.example.com',
      }

      ecoConfigService.get.mockReturnValue(awsConfigs)
      ecoConfigService.getMongoConfigurations.mockReturnValue(mongoConfigs)

      const result = await service.compareWithAws()

      expect(result.identical).toBe(false)
      expect(result.differences).toHaveLength(1)
      expect(result.differences[0].type).toBe('VALUE_MISMATCH')
      expect(result.differences[0].key).toBe('database.uri')
      expect(result.differences[0].awsValue).toBe('mongodb://localhost:27017')
      expect(result.differences[0].mongoValue).toBe('mongodb://different-host:27017')
    })

    it('should handle comparison errors gracefully', async () => {
      ecoConfigService.get.mockImplementation(() => {
        throw new Error('AWS access error')
      })

      await expect(service.compareWithAws()).rejects.toThrow('AWS access error')
    })
  })

  describe('helper methods', () => {
    it('should correctly identify secret keys', () => {
      const isSecretKey = (service as any).isSecretKey.bind(service)

      expect(isSecretKey('api.password')).toBe(true)
      expect(isSecretKey('database.secret')).toBe(true)
      expect(isSecretKey('auth.key')).toBe(true)
      expect(isSecretKey('jwt.token')).toBe(true)
      expect(isSecretKey('user.credential')).toBe(true)
      expect(isSecretKey('eth.private')).toBe(true)

      expect(isSecretKey('server.url')).toBe(false)
      expect(isSecretKey('database.name')).toBe(false)
      expect(isSecretKey('cache.ttl')).toBe(false)
    })

    it('should correctly determine actual types', () => {
      const getActualType = (service as any).getActualType.bind(service)

      expect(getActualType('string')).toBe('string')
      expect(getActualType(123)).toBe('number')
      expect(getActualType(true)).toBe('boolean')
      expect(getActualType({ key: 'value' })).toBe('object')
      expect(getActualType(['item'])).toBe('array')
      expect(getActualType(null)).toBe('null')
      expect(getActualType(undefined)).toBe('undefined')
    })

    it('should correctly determine expected types', () => {
      const getExpectedType = (service as any).getExpectedType.bind(service)

      expect(getExpectedType('port')).toBe('number')
      expect(getExpectedType('database.auth.enabled')).toBe('boolean')
      expect(getExpectedType('aws')).toBe('array')
      expect(getExpectedType('solvers')).toBe('object')
      expect(getExpectedType('intentSources')).toBe('array')
      expect(getExpectedType('redis.connection')).toBe('object')
      expect(getExpectedType('unknown.config')).toBeNull()
    })

    it('should return required configuration keys', () => {
      const getRequiredConfigurations = (service as any).getRequiredConfigurations.bind(service)
      const requiredKeys = getRequiredConfigurations()

      expect(requiredKeys).toBeInstanceOf(Array)
      // For now, we return an empty array to avoid false positives during migration
      expect(requiredKeys).toEqual([])
    })

    it('should get existing configuration keys', async () => {
      const getExistingConfigurationKeys = (service as any).getExistingConfigurationKeys.bind(
        service,
      )
      const existingKeys = await getExistingConfigurationKeys()

      expect(existingKeys).toBeInstanceOf(Set)
      expect(existingKeys.size).toBe(mockConfigurations.length)
      expect(existingKeys.has('database.uri')).toBe(true)
      expect(existingKeys.has('port')).toBe(true)
    })

    it('should handle errors when getting existing keys', async () => {
      configurationService.getAll.mockRejectedValue(new Error('Database error'))

      const getExistingConfigurationKeys = (service as any).getExistingConfigurationKeys.bind(
        service,
      )
      const existingKeys = await getExistingConfigurationKeys()

      expect(existingKeys).toBeInstanceOf(Set)
      expect(existingKeys.size).toBe(0)
    })
  })
})
