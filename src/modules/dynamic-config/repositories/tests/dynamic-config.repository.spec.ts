import {
  BulkConfigurationOperation,
  ConfigurationFilter,
  CreateConfigurationDTO,
  UpdateConfigurationDTO,
} from '@/modules/dynamic-config/interfaces/configuration-repository.interface';
import {
  Configuration,
  ConfigurationDocument,
} from '@/modules/dynamic-config/schemas/configuration.schema';
import { DynamicConfigRepository } from '@/modules/dynamic-config/repositories/dynamic-config.repository';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Test, TestingModule } from '@nestjs/testing';

describe('DynamicConfigRepository', () => {
  let repository: DynamicConfigRepository;
  let model: jest.Mocked<Model<ConfigurationDocument>>;

  const mockConfigurationDocument = {
    _id: 'mock-id',
    key: 'test.key',
    value: 'test-value',
    type: 'string',
    isRequired: false,
    description: 'Test config',
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
    toObject: jest.fn(),
  } as any;

  beforeEach(async () => {
    const mockModel = jest.fn().mockImplementation(() => ({
      ...mockConfigurationDocument,
      save: jest.fn().mockResolvedValue(mockConfigurationDocument),
    }));

    // Add static methods to the mock model
    Object.assign(mockModel, {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      countDocuments: jest.fn(),
      exists: jest.fn(),
      aggregate: jest.fn(),
      deleteMany: jest.fn(),
      collection: {
        getIndexes: jest.fn(),
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicConfigRepository,
        {
          provide: getModelToken(Configuration.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    repository = module.get<DynamicConfigRepository>(DynamicConfigRepository);
    model = module.get<Model<ConfigurationDocument>>(
      getModelToken(Configuration.name),
    ) as jest.Mocked<Model<ConfigurationDocument>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDTO: CreateConfigurationDTO = {
      key: 'test.key',
      value: 'test-value',
      type: 'string',
      isRequired: false,
      description: 'Test configuration',
    };

    it('should create a configuration successfully', async () => {
      const mockSave = jest.fn().mockResolvedValue(mockConfigurationDocument);
      (model as any).mockImplementationOnce(() => ({
        ...mockConfigurationDocument,
        save: mockSave,
      }));

      const result = await repository.create(createDTO);

      expect(model).toHaveBeenCalledWith({
        ...createDTO,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockConfigurationDocument);
    });

    it('should throw error for invalid key format', async () => {
      const invalidDTO = { ...createDTO, key: 'invalid key!' };

      await expect(repository.create(invalidDTO)).rejects.toThrow(
        'Validation failed: Key must contain only alphanumeric characters, dots, underscores, and hyphens',
      );
    });

    it('should throw error for mismatched value type', async () => {
      const invalidDTO = { ...createDTO, value: 123, type: 'string' as const };

      await expect(repository.create(invalidDTO)).rejects.toThrow(
        "Validation failed: Value type 'number' does not match declared type 'string'",
      );
    });

    it('should handle database errors', async () => {
      const mockSave = jest.fn().mockRejectedValue(new Error('Database error'));
      (model as any).mockImplementationOnce(() => ({
        ...mockConfigurationDocument,
        save: mockSave,
      }));

      await expect(repository.create(createDTO)).rejects.toThrow('Database error');
    });
  });

  describe('findByKey', () => {
    it('should find configuration by key', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockConfigurationDocument);
      model.findOne.mockReturnValue({ exec: mockExec } as any);

      const result = await repository.findByKey('test.key');

      expect(model.findOne).toHaveBeenCalledWith({ key: 'test.key' });
      expect(result).toEqual(mockConfigurationDocument);
    });

    it('should return null when configuration not found', async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      model.findOne.mockReturnValue({ exec: mockExec } as any);

      const result = await repository.findByKey('nonexistent.key');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockExec = jest.fn().mockRejectedValue(new Error('Database error'));
      model.findOne.mockReturnValue({ exec: mockExec } as any);

      await expect(repository.findByKey('test.key')).rejects.toThrow('Database error');
    });
  });

  describe('findAll', () => {
    const mockConfigs = [
      mockConfigurationDocument,
      { ...mockConfigurationDocument, key: 'test.key2' },
    ];

    it('should find all configurations with pagination', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockConfigs);
      const mockCountExec = jest.fn().mockResolvedValue(2);

      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({ exec: mockCountExec } as any);

      const result = await repository.findAllWithFilteringAndPagination(
        {},
        {
          page: 1,
          limit: 10,
        },
      );

      expect(result.data).toEqual(mockConfigs);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should apply filters correctly', async () => {
      const filter: ConfigurationFilter = {
        type: 'string',
        isRequired: true,
        keys: ['test.key1', 'test.key2'],
      };

      const mockExec = jest.fn().mockResolvedValue([]);
      const mockCountExec = jest.fn().mockResolvedValue(0);

      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({ exec: mockCountExec } as any);

      await repository.findAllWithFilteringAndPagination(filter);

      expect(model.find).toHaveBeenCalledWith({
        key: { $in: ['test.key1', 'test.key2'] },
        type: 'string',
        isRequired: true,
      });
    });
  });

  describe('update', () => {
    const updateDTO: UpdateConfigurationDTO = {
      value: 'updated-value',
      description: 'Updated description',
    };

    it('should update configuration successfully', async () => {
      const updatedDoc = { ...mockConfigurationDocument, ...updateDTO };
      const mockExec = jest.fn().mockResolvedValue(updatedDoc);

      model.findOneAndUpdate.mockReturnValue({ exec: mockExec } as any);

      const result = await repository.update('test.key', updateDTO);

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'test.key' },
        { ...updateDTO, updatedAt: expect.any(Date) },
        { new: true, runValidators: true },
      );
      expect(result).toEqual(updatedDoc);
    });

    it('should return null when configuration not found', async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      model.findOneAndUpdate.mockReturnValue({ exec: mockExec } as any);

      const result = await repository.update('nonexistent.key', updateDTO);

      expect(result).toBeNull();
    });

    it('should validate update data', async () => {
      const invalidDTO = { value: 123, type: 'string' as const };

      await expect(repository.update('test.key', invalidDTO)).rejects.toThrow(
        "Validation failed: Value type 'number' does not match declared type 'string'",
      );
    });
  });

  describe('delete', () => {
    it('should delete configuration successfully', async () => {
      const mockExec = jest.fn().mockResolvedValue({ deletedCount: 1 });
      model.deleteOne.mockReturnValue({ exec: mockExec } as any);

      const result = await repository.delete('test.key');

      expect(model.deleteOne).toHaveBeenCalledWith({ key: 'test.key' });
      expect(result).toBe(true);
    });

    it('should return false when configuration not found', async () => {
      const mockExec = jest.fn().mockResolvedValue({ deletedCount: 0 });
      model.deleteOne.mockReturnValue({ exec: mockExec } as any);

      const result = await repository.delete('nonexistent.key');

      expect(result).toBe(false);
    });
  });

  describe('bulkOperations', () => {
    it('should handle mixed bulk operations', async () => {
      const operations: BulkConfigurationOperation[] = [
        {
          key: 'create.key',
          operation: 'create',
          data: { key: 'create.key', value: 'value', type: 'string' },
        },
        {
          key: 'update.key',
          operation: 'update',
          data: { value: 'updated-value' },
        },
        {
          key: 'delete.key',
          operation: 'delete',
        },
      ];

      // Mock create operation
      const mockSave = jest.fn().mockResolvedValue(mockConfigurationDocument);
      (model as any).mockImplementationOnce(() => ({
        ...mockConfigurationDocument,
        save: mockSave,
      }));

      // Mock update operation
      const mockUpdateExec = jest.fn().mockResolvedValue(mockConfigurationDocument);
      model.findOneAndUpdate.mockReturnValue({ exec: mockUpdateExec } as any);

      // Mock delete operation
      const mockDeleteExec = jest.fn().mockResolvedValue({ deletedCount: 1 });
      model.deleteOne.mockReturnValue({ exec: mockDeleteExec } as any);

      const result = await repository.bulkOperations(operations);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0].operation).toBe('create');
      expect(result.successful[1].operation).toBe('update');
      expect(result.successful[2].operation).toBe('delete');
    });

    it('should handle failed operations', async () => {
      const operations: BulkConfigurationOperation[] = [
        {
          key: 'invalid.key!',
          operation: 'create',
          data: { key: 'invalid.key!', value: 'value', type: 'string' },
        },
      ];

      const result = await repository.bulkOperations(operations);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Key must contain only alphanumeric characters');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate valid configuration', async () => {
      const validConfig: CreateConfigurationDTO = {
        key: 'valid.key',
        value: 'test-value',
        type: 'string',
      };

      const errors = await repository.validateConfiguration(validConfig);

      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid key format', async () => {
      const invalidConfig = {
        key: 'invalid key!',
        value: 'test',
        type: 'string' as const,
      };

      const errors = await repository.validateConfiguration(invalidConfig);

      expect(errors).toContain(
        'Key must contain only alphanumeric characters, dots, underscores, and hyphens',
      );
    });

    it('should return errors for type mismatch', async () => {
      const invalidConfig = {
        key: 'test.key',
        value: 123,
        type: 'string' as const,
      };

      const errors = await repository.validateConfiguration(invalidConfig);

      expect(errors).toContain("Value type 'number' does not match declared type 'string'");
    });

    it('should return errors for missing required fields', async () => {
      const invalidConfig = {
        key: '',
        type: 'string' as const,
      };

      const errors = await repository.validateConfiguration(invalidConfig);

      expect(errors).toContain('Key is required');
      expect(errors).toContain('Value is required');
    });
  });

  describe('exists', () => {
    it('should return true when configuration exists', async () => {
      model.exists.mockResolvedValue({ _id: 'mock-id' } as any);

      const result = await repository.exists('test.key');

      expect(model.exists).toHaveBeenCalledWith({ key: 'test.key' });
      expect(result).toBe(true);
    });

    it('should return false when configuration does not exist', async () => {
      model.exists.mockResolvedValue(null);

      const result = await repository.exists('nonexistent.key');

      expect(model.exists).toHaveBeenCalledWith({ key: 'nonexistent.key' });
      expect(result).toBe(false);
    });
  });

  describe('findRequired', () => {
    it('should find all required configurations', async () => {
      const mockExec = jest.fn().mockResolvedValue([mockConfigurationDocument]);
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: mockExec,
        }),
      } as any);

      const result = await repository.findRequired();

      expect(model.find).toHaveBeenCalledWith({ isRequired: true });
      expect(result).toEqual([mockConfigurationDocument]);
    });
  });

  describe('findMissingRequired', () => {
    it('should find missing required configurations', async () => {
      const requiredKeys = ['key1', 'key2', 'key3'];
      const existingConfigs = [{ key: 'key1' }, { key: 'key3' }];

      const mockExec = jest.fn().mockResolvedValue(existingConfigs);
      model.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: mockExec,
        }),
      } as any);

      const result = await repository.findMissingRequired(requiredKeys);

      expect(model.find).toHaveBeenCalledWith({ key: { $in: requiredKeys } });
      expect(result).toEqual(['key2']);
    });
  });

  describe('healthCheck', () => {
    it('should return true when database is healthy', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockConfigurationDocument);
      model.findOne.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: mockExec,
        }),
      } as any);

      const result = await repository.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when database is unhealthy', async () => {
      const mockExec = jest.fn().mockRejectedValue(new Error('Database error'));

      model.findOne.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: mockExec,
        }),
      } as any);

      const result = await repository.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should return configuration statistics', async () => {
      const mockStats = [
        { _id: 'string', count: 5 },
        { _id: 'number', count: 3 },
      ];

      const mockExec = jest
        .fn()
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(mockStats) // typeStats
        .mockResolvedValueOnce(3) // required
        .mockResolvedValueOnce({ updatedAt: new Date('2023-01-01') }); // lastModified

      model.countDocuments.mockReturnValue({ exec: mockExec } as any);
      model.aggregate.mockReturnValue({ exec: mockExec } as any);
      model.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            exec: mockExec,
          }),
        }),
      } as any);

      const result = await repository.getStatistics();

      expect(result).toEqual({
        total: 10,
        byType: { string: 5, number: 3 },
        required: 3,
        lastModified: new Date('2023-01-01'),
      });
    });
  });
});
