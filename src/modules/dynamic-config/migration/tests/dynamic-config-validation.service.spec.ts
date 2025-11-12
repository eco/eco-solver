/* eslint-disable @typescript-eslint/no-unused-vars */
import { DynamicConfigService } from '@/modules/dynamic-config/services/dynamic-config.service';
import { DynamicConfigValidationService } from '@/modules/dynamic-config/migration/dynamic-config-validation.service';
import { ConfigFactory } from '@/config/config-factory';
import { Test, TestingModule } from '@nestjs/testing';

describe('DynamicConfigValidationService', () => {
  let service: DynamicConfigValidationService;
  let configurationService: jest.Mocked<DynamicConfigService>;
  let ecoConfigService: jest.Mocked<ConfigFactory>;

  const mockConfigurations = [
    {
      key: 'mongodb',
      value: {
        uri: 'mongodb://localhost:27017/test',
      },
      type: 'object' as const,
      isRequired: true,
      lastModified: new Date(),
    },
    {
      key: 'redis',
      value: {
        connection: { host: 'localhost', port: 6379 },
      },
      type: 'object' as const,
      isRequired: true,
      lastModified: new Date(),
    },
  ];

  beforeEach(async () => {
    const mockConfigurationService = {
      getAll: jest.fn(),
    };

    const mockEcoConfigService = {
      get: jest.fn(),
      getMongoConfigurations: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicConfigValidationService,
        { provide: DynamicConfigService, useValue: mockConfigurationService },
        { provide: ConfigFactory, useValue: mockEcoConfigService },
      ],
    }).compile();

    service = module.get<DynamicConfigValidationService>(DynamicConfigValidationService);
    configurationService = module.get(DynamicConfigService);
    ecoConfigService = module.get(ConfigFactory);
  });

  describe('validateAllConfigurations', () => {
    it('should validate all configurations successfully', async () => {
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
      });

      const result = await service.validateAllConfigurations();

      expect(result.valid).toBe(true);
      expect(result.summary.totalConfigurations).toBe(mockConfigurations.length);
      expect(result.summary.validConfigurations).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
    });

    it('should return an error for a config value that is missing a schema', async () => {
      const testConfigs = [
        ...mockConfigurations,
        {
          key: 'api',
          value: {
            secret: 'production-secret-key-123',
          },
          type: 'object' as const,
          isRequired: false,
          lastModified: new Date(),
        },
      ];

      configurationService.getAll.mockResolvedValue({
        data: testConfigs,
        pagination: {
          page: 1,
          limit: 50,
          total: testConfigs.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const result = await service.validateAllConfigurations();

      expect(result.valid).toBe(false);
      expect(result.summary.totalConfigurations).toBe(testConfigs.length);
      expect(result.summary.validConfigurations).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('SCHEMA_VIOLATION');
      expect(result.errors[0].message).toBe(`Missing schema for api`);
    });

    it('should handle validation errors gracefully', async () => {
      configurationService.getAll.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.validateAllConfigurations();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('SCHEMA_VIOLATION');
      expect(result.errors[0].key).toBe('VALIDATION_ERROR');
    });
  });

  describe('validateSingleConfiguration', () => {
    it('should validate a valid configuration', async () => {
      const result = await service.validateSingleConfiguration('mongodb', {
        uri: 'mongodb://localhost:27017/test',
      });

      expect(result.errors).toEqual([]);
    });

    it('should detect security warnings for weak secrets', async () => {
      // The service checks for secret keywords in the key name and string values
      const result = await service.validateSingleConfiguration('api-secret', '123');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('SECURITY');
      expect(result.warnings[0].message).toContain('too short');
    });

    it('should detect security warnings for test secrets', async () => {
      // The service checks for secret keywords in the key name and string values
      const result = await service.validateSingleConfiguration('api-secret', 'test-secret-123');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('SECURITY');
      expect(result.warnings[0].message).toContain('test/demo value');
    });

    it('should detect security warnings for insecure URLs', async () => {
      // The service checks for 'url' or 'uri' in the key name and string values
      const result = await service.validateSingleConfiguration(
        'server-url',
        'http://api.example.com',
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('SECURITY');
      expect(result.warnings[0].message).toContain('HTTP instead of HTTPS');
    });

    it('should detect performance warnings for large configurations', async () => {
      const largeValue = { data: 'x'.repeat(15000) };
      const result = await service.validateSingleConfiguration('large-config', largeValue);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('PERFORMANCE');
      expect(result.warnings[0].message).toContain('very large');
    });

    it('should detect performance warnings for large arrays', async () => {
      const largeArray = Array(150).fill('item');
      const result = await service.validateSingleConfiguration('large-array', largeArray);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('PERFORMANCE');
      expect(result.warnings[0].message).toContain('array is very large');
    });
  });

  describe('compareWithAws', () => {
    it('should detect identical configurations', async () => {
      const configs = {
        database: { uri: 'mongodb://localhost:27017' },
        server: { url: 'https://api.example.com' },
      };

      // ecoConfigService.get.mockReturnValue(configs)
      ConfigFactory.getAWSConfigValues = () => {
        return configs;
      };

      // ecoConfigService.getMongoConfigurations.mockReturnValue(configs)
      ConfigFactory.getMongoConfigurations = () => {
        return configs;
      };

      const result = await service.compareWithAws();

      expect(result.identical).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect missing configurations in MongoDB', async () => {
      const awsConfigs = {
        database: { uri: 'mongodb://localhost:27017' },
        server: { url: 'https://api.example.com' },
      };
      const mongoConfigs = {
        database: { uri: 'mongodb://localhost:27017' },
        // Missing server
      };

      // ecoConfigService.get.mockReturnValue(awsConfigs)
      ConfigFactory.getAWSConfigValues = () => {
        return awsConfigs;
      };

      // ecoConfigService.getMongoConfigurations.mockReturnValue(mongoConfigs)
      ConfigFactory.getMongoConfigurations = () => {
        return mongoConfigs;
      };

      const result = await service.compareWithAws();

      expect(result.identical).toBe(false);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].type).toBe('MISSING_IN_MONGO');
      expect(result.differences[0].key).toBe('server');
    });

    it('should detect missing configurations in AWS', async () => {
      const awsConfigs = {
        database: { uri: 'mongodb://localhost:27017' },
      };
      const mongoConfigs = {
        database: { uri: 'mongodb://localhost:27017' },
        server: { url: 'https://api.example.com' },
      };

      // ecoConfigService.get.mockReturnValue(awsConfigs)
      ConfigFactory.getAWSConfigValues = () => {
        return awsConfigs;
      };

      // ecoConfigService.getMongoConfigurations.mockReturnValue(mongoConfigs)
      ConfigFactory.getMongoConfigurations = () => {
        return mongoConfigs;
      };

      const result = await service.compareWithAws();

      expect(result.identical).toBe(false);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].type).toBe('MISSING_IN_AWS');
      expect(result.differences[0].key).toBe('server');
    });

    it('should detect value mismatches', async () => {
      const awsConfigs = {
        database: { uri: 'mongodb://localhost:27017' },
        server: { url: 'https://api.example.com' },
      };
      const mongoConfigs = {
        database: { uri: 'mongodb://different-host:27017' },
        server: { url: 'https://api.example.com' },
      };

      // ecoConfigService.get.mockReturnValue(awsConfigs)
      ConfigFactory.getAWSConfigValues = () => {
        return awsConfigs;
      };

      // ecoConfigService.getMongoConfigurations.mockReturnValue(mongoConfigs)
      ConfigFactory.getMongoConfigurations = () => {
        return mongoConfigs;
      };

      const result = await service.compareWithAws();

      expect(result.identical).toBe(false);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].type).toBe('VALUE_MISMATCH');
      expect(result.differences[0].key).toBe('database');
      expect(result.differences[0].awsValue).toEqual({ uri: 'mongodb://localhost:27017' });
      expect(result.differences[0].mongoValue).toEqual({ uri: 'mongodb://different-host:27017' });
    });

    it('should handle comparison errors gracefully', async () => {
      ConfigFactory.getAWSConfigValues = () => {
        throw new Error('AWS access failed');
      };

      // ecoConfigService.get.mockImplementation(() => {
      //   throw new Error('AWS access failed')
      // })

      await expect(service.compareWithAws()).rejects.toThrow('AWS access failed');
    });
  });
});
