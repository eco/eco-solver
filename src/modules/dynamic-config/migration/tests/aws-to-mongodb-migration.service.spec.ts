import {
  AwsToMongoDbMigrationService,
  MigrationOptions,
} from '@/modules/dynamic-config/migration/aws-to-mongodb-migration.service';
import { DynamicConfigService } from '@/modules/dynamic-config/services/dynamic-config.service';
import { ConfigFactory } from '@/config/config-factory';
import { Test, TestingModule } from '@nestjs/testing';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager');

describe('AwsToMongoDbMigrationService', () => {
  let service: AwsToMongoDbMigrationService;
  let configurationService: jest.Mocked<DynamicConfigService>;

  const mockAwsSecrets = {
    mongodb: {
      uri: 'mongodb://localhost:27017',
      dbName: 'test-db',
    },
    server: {
      url: 'https://api.example.com',
    },
    redis: {
      host: 'localhost',
    },
    api: {
      key: 'secret-api-key',
    },
  } as Record<string, any>;

  const mockExistingConfigs = [
    {
      key: 'existing.config',
      value: 'existing-value',
      type: 'string' as const,
      isRequired: false,
      lastModified: new Date(),
    },
  ];

  beforeEach(async () => {
    const mockConfigurationService = {
      getAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AwsToMongoDbMigrationService,
        {
          provide: DynamicConfigService,
          useValue: mockConfigurationService,
        },
      ],
    }).compile();

    service = module.get<AwsToMongoDbMigrationService>(AwsToMongoDbMigrationService);
    configurationService = module.get(DynamicConfigService);

    // Setup default mocks
    configurationService.getAll.mockResolvedValue({
      data: mockExistingConfigs,
      pagination: {
        page: 1,
        limit: 50,
        total: mockExistingConfigs.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    ConfigFactory.getMongoConfigurations = () => {
      return {};
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('migrateFromAws', () => {
    beforeEach(() => {
      ConfigFactory.getAWSConfigValues = () => {
        return mockAwsSecrets;
      };
    });

    it('should successfully migrate AWS configurations to MongoDB', async () => {
      const options: MigrationOptions = {
        dryRun: false,
        overwriteExisting: false,
        userId: 'test-user',
        migrateAll: true,
      };

      configurationService.create.mockResolvedValue({} as any);

      const result = await service.migrateFromAws(options);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(Object.keys(mockAwsSecrets).length);
      expect(result.errorCount).toBe(0);
      expect(result.summary.totalConfigurations).toBe(Object.keys(mockAwsSecrets).length);
      expect(configurationService.create).toHaveBeenCalledTimes(Object.keys(mockAwsSecrets).length);
    });

    it('should perform dry run without making changes', async () => {
      const options: MigrationOptions = {
        dryRun: true,
        overwriteExisting: false,
        userId: 'test-user',
        migrateAll: true,
      };

      const result = await service.migrateFromAws(options);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(Object.keys(mockAwsSecrets).length);
      expect(configurationService.create).not.toHaveBeenCalled();
      expect(configurationService.update).not.toHaveBeenCalled();
    });

    it('should skip existing configurations when overwrite is false', async () => {
      configurationService.getAll.mockResolvedValue({
        data: [
          {
            key: 'mongodb',
            value: { uri: 'existing-uri', dbName: 'existing-db' },
            type: 'object' as const,
            isRequired: true,
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
      });

      const options: MigrationOptions = {
        dryRun: false,
        overwriteExisting: false,
        userId: 'test-user',
        migrateAll: true,
      };

      const result = await service.migrateFromAws(options);

      expect(result.skippedCount).toBe(1);
      expect(result.summary.existingConfigurations).toBe(1);
      expect(configurationService.create).toHaveBeenCalledTimes(
        Object.keys(mockAwsSecrets).length - 1,
      );
    });

    it('should overwrite existing configurations when overwrite is true', async () => {
      configurationService.getAll.mockResolvedValue({
        data: [
          {
            key: 'mongodb',
            value: { uri: 'existing-uri', dbName: 'existing-db' },
            type: 'object' as const,
            isRequired: true,
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
      });

      const options: MigrationOptions = {
        dryRun: false,
        overwriteExisting: true,
        userId: 'test-user',
        migrateAll: true,
      };

      configurationService.update.mockResolvedValue({} as any);
      configurationService.create.mockResolvedValue({} as any);

      const result = await service.migrateFromAws(options);

      expect(result.migratedCount).toBe(Object.keys(mockAwsSecrets).length);
      expect(configurationService.update).toHaveBeenCalledWith(
        'mongodb',
        { value: { uri: 'mongodb://localhost:27017', dbName: 'test-db' } },
        'test-user',
      );
    });

    it('should handle configuration creation errors', async () => {
      configurationService.create.mockRejectedValue(new Error('Database error'));

      const options: MigrationOptions = {
        dryRun: false,
        overwriteExisting: false,
        userId: 'test-user',
        migrateAll: true,
      };

      const result = await service.migrateFromAws(options);

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(Object.keys(mockAwsSecrets).length);
      expect(result.errors).toHaveLength(Object.keys(mockAwsSecrets).length);
    });

    it('should filter configurations by specified keys', async () => {
      const options: MigrationOptions = {
        dryRun: false,
        overwriteExisting: false,
        userId: 'test-user',
        keys: 'mongodb,redis', // Only migrate mongodb and redis configs
      };

      configurationService.create.mockResolvedValue({} as any);

      const result = await service.migrateFromAws(options);

      expect(result.success).toBe(true);
      // Should only migrate 2 top-level keys (database, redis) instead of all 4 configs
      expect(result.migratedCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.summary.totalConfigurations).toBe(2);

      // Verify the correct configurations were created
      expect(configurationService.create).toHaveBeenCalledTimes(2);

      // Check that database config was created with nested structure
      expect(configurationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'mongodb',
          value: expect.objectContaining({
            uri: 'mongodb://localhost:27017',
            dbName: 'test-db',
          }),
          type: 'object',
        }),
        'test-user',
      );

      // Check that redis config was created
      expect(configurationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'redis',
          value: expect.objectContaining({
            host: 'localhost',
          }),
          type: 'object',
        }),
        'test-user',
      );
    });

    it('should migrate all configurations when migrate-all flag is used', async () => {
      const options: MigrationOptions = {
        dryRun: false,
        overwriteExisting: false,
        userId: 'test-user',
        migrateAll: true,
      };

      configurationService.create.mockResolvedValue({} as any);

      const result = await service.migrateFromAws(options);

      expect(result.success).toBe(true);
      // Should migrate all 4 top-level configurations
      expect(result.migratedCount).toBe(Object.keys(mockAwsSecrets).length);
      expect(configurationService.create).toHaveBeenCalledTimes(Object.keys(mockAwsSecrets).length);
    });
  });

  describe('validateMigration', () => {
    it('should validate successful migration', async () => {
      ConfigFactory.getAWSConfigValues = () => {
        return mockAwsSecrets;
      };

      ConfigFactory.getMongoConfigurations = () => {
        return mockAwsSecrets;
      };

      const result = await service.validateMigration();

      expect(result.valid).toBe(true);
      expect(result.missingKeys).toHaveLength(0);
      expect(result.mismatchedValues).toHaveLength(0);
    });

    it('should detect missing keys', async () => {
      ConfigFactory.getAWSConfigValues = () => {
        return mockAwsSecrets;
      };

      ConfigFactory.getMongoConfigurations = () => {
        return {
          database: { uri: 'mongodb://localhost:27017' },
          // Missing other top-level keys (server, redis, api)
        };
      };

      const result = await service.validateMigration();

      expect(result.valid).toBe(false);
      expect(result.missingKeys.length).toBeGreaterThan(0);
      expect(result.missingKeys).toContain('server');
    });

    it('should detect mismatched values', async () => {
      ConfigFactory.getAWSConfigValues = () => {
        return mockAwsSecrets;
      };

      ConfigFactory.getMongoConfigurations = () => {
        return {
          ...mockAwsSecrets,
          mongodb: {
            ...mockAwsSecrets.database,
            uri: 'mongodb://different-host:27017', // Different value
          },
        };
      };

      const result = await service.validateMigration();

      expect(result.valid).toBe(false);
      expect(result.mismatchedValues.length).toBeGreaterThan(0);
      expect(result.mismatchedValues[0].key).toBe('mongodb');
    });
  });

  describe('createRollbackPlan', () => {
    it('should create rollback plan for migrated configurations', async () => {
      ConfigFactory.getAWSConfigValues = () => {
        return mockAwsSecrets;
      };

      // Mock configurationService.getAll() to return configurations that exist in MongoDB
      const mongoConfigs = Object.keys(mockAwsSecrets).map((key) => ({
        key,
        value: mockAwsSecrets[key],
        type: 'string' as const,
        isRequired: true,
        lastModified: new Date(),
      }));

      configurationService.getAll.mockResolvedValue({
        data: mongoConfigs,
        pagination: {
          page: 1,
          limit: 50,
          total: mongoConfigs.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      ConfigFactory.getMongoConfigurations = () => {
        return mockAwsSecrets;
      };

      const rollbackPlan = await service.createRollbackPlan();

      expect(rollbackPlan.configurationsToDelete).toEqual(Object.keys(mockAwsSecrets));
      expect(rollbackPlan.configurationsToRestore).toHaveLength(0);
    });
  });

  describe('executeRollback', () => {
    it('should successfully execute rollback plan', async () => {
      const rollbackPlan = {
        configurationsToDelete: ['database.uri', 'server.url'],
        configurationsToRestore: [],
      };

      configurationService.delete.mockResolvedValue(true);

      const result = await service.executeRollback(rollbackPlan, 'test-user');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(configurationService.delete).toHaveBeenCalledTimes(2);
      expect(configurationService.delete).toHaveBeenCalledWith('database.uri', 'test-user');
      expect(configurationService.delete).toHaveBeenCalledWith('server.url', 'test-user');
    });

    it('should handle rollback errors gracefully', async () => {
      const rollbackPlan = {
        configurationsToDelete: ['database.uri', 'server.url'],
        configurationsToRestore: [],
      };

      configurationService.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await service.executeRollback(rollbackPlan, 'test-user');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Failed to delete database.uri');
    });
  });

  describe('helper methods', () => {
    it('should correctly infer configuration types', () => {
      const inferType = (service as any).inferConfigurationType.bind(service);

      expect(inferType('string value')).toBe('string');
      expect(inferType(123)).toBe('number');
      expect(inferType(true)).toBe('boolean');
      expect(inferType({ key: 'value' })).toBe('object');
      expect(inferType(['item1', 'item2'])).toBe('array');
    });

    it('should correctly detect required configurations', () => {
      const isRequired = (service as any).isRequiredConfiguration.bind(service);

      expect(isRequired('database.uri')).toBe(true);
      expect(isRequired('server.port')).toBe(true);
      expect(isRequired('redis.connection')).toBe(true);
      expect(isRequired('optional.setting')).toBe(false);
      expect(isRequired('feature.flag')).toBe(false);
    });
  });
});
