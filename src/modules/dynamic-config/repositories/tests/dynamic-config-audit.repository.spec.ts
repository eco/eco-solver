import {
  AuditFilter,
  AuditLogEntry,
  DynamicConfigAuditRepository,
} from '@/modules/dynamic-config/repositories/dynamic-config-audit.repository';
import {
  ConfigurationAudit,
  ConfigurationAuditDocument,
} from '@/modules/dynamic-config/schemas/configuration-audit.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Test, TestingModule } from '@nestjs/testing';

describe('DynamicConfigAuditRepository', () => {
  let repository: DynamicConfigAuditRepository;
  let model: jest.Mocked<Model<ConfigurationAuditDocument>>;

  const mockAuditDocument = {
    _id: 'mock-audit-id',
    configKey: 'test.key',
    operation: 'CREATE',
    newValue: 'test-value',
    userId: 'user123',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
  } as any;

  const mockAuditEntry: AuditLogEntry = {
    configKey: 'test.key',
    operation: 'CREATE',
    newValue: 'test-value',
    userId: 'user123',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date(),
  };

  beforeEach(async () => {
    const mockModel = jest.fn().mockImplementation(() => ({
      ...mockAuditDocument,
      save: jest.fn().mockResolvedValue(mockAuditDocument),
    }));

    Object.assign(mockModel, {
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicConfigAuditRepository,
        {
          provide: getModelToken(ConfigurationAudit.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    repository = module.get<DynamicConfigAuditRepository>(DynamicConfigAuditRepository);
    model = module.get<Model<ConfigurationAuditDocument>>(
      getModelToken(ConfigurationAudit.name),
    ) as jest.Mocked<Model<ConfigurationAuditDocument>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create audit log successfully', async () => {
      const mockSave = jest.fn().mockResolvedValue(mockAuditDocument);
      (model as any).mockImplementation(() => ({
        ...mockAuditDocument,
        save: mockSave,
      }));

      const result = await repository.create(mockAuditEntry);

      expect(model).toHaveBeenCalledWith({
        configKey: mockAuditEntry.configKey,
        operation: mockAuditEntry.operation,
        oldValue: mockAuditEntry.oldValue,
        newValue: mockAuditEntry.newValue,
        userId: mockAuditEntry.userId,
        userAgent: mockAuditEntry.userAgent,
        timestamp: mockAuditEntry.timestamp,
      });
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockAuditDocument);
    });

    it('should handle database errors', async () => {
      const mockSave = jest.fn().mockRejectedValue(new Error('Database error'));
      (model as any).mockImplementation(() => ({
        ...mockAuditDocument,
        save: mockSave,
      }));

      await expect(repository.create(mockAuditEntry)).rejects.toThrow('Database error');
    });
  });

  describe('findHistory', () => {
    it('should find configuration history with default pagination', async () => {
      const mockExec = jest.fn().mockResolvedValue([mockAuditDocument]);
      const mockCountExec = jest.fn().mockResolvedValue(1);

      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({
        exec: mockCountExec,
      } as any);

      const result = await repository.findHistory('test.key');

      expect(model.find).toHaveBeenCalledWith({ configKey: 'test.key' });
      expect(result).toEqual({
        logs: [mockAuditDocument],
        total: 1,
      });
    });

    it('should find configuration history with custom pagination', async () => {
      const mockExec = jest.fn().mockResolvedValue([mockAuditDocument]);
      const mockCountExec = jest.fn().mockResolvedValue(1);

      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({
        exec: mockCountExec,
      } as any);

      await repository.findHistory('test.key', 10, 5);

      const sortMock = model.find().sort as jest.Mock;
      const skipMock = sortMock().skip as jest.Mock;
      const limitMock = skipMock().limit as jest.Mock;

      expect(skipMock).toHaveBeenCalledWith(5);
      expect(limitMock).toHaveBeenCalledWith(10);
    });

    it('should handle database errors', async () => {
      const mockExec = jest.fn().mockRejectedValue(new Error('Database error'));
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      } as any);

      await expect(repository.findHistory('test.key')).rejects.toThrow('Database error');
    });
  });

  describe('findUserActivity', () => {
    it('should find user activity', async () => {
      const mockExec = jest.fn().mockResolvedValue([mockAuditDocument]);
      const mockCountExec = jest.fn().mockResolvedValue(1);

      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({
        exec: mockCountExec,
      } as any);

      const result = await repository.findUserActivity('user123');

      expect(model.find).toHaveBeenCalledWith({ userId: 'user123' });
      expect(result).toEqual({
        logs: [mockAuditDocument],
        total: 1,
      });
    });

    it('should handle database errors', async () => {
      const mockExec = jest.fn().mockRejectedValue(new Error('Database error'));
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      } as any);

      await expect(repository.findUserActivity('user123')).rejects.toThrow('Database error');
    });
  });

  describe('getStatistics', () => {
    it('should get audit statistics', async () => {
      const mockAggregateResult = [
        {
          totalOperations: [{ count: 100 }],
          operationCounts: [
            { operation: 'CREATE', count: 50 },
            { operation: 'UPDATE', count: 30 },
            { operation: 'DELETE', count: 20 },
          ],
          topUsers: [
            { userId: 'user1', count: 40 },
            { userId: 'user2', count: 30 },
          ],
          topConfigs: [
            { configKey: 'config1', count: 25 },
            { configKey: 'config2', count: 20 },
          ],
        },
      ];

      const mockRecentActivity = [mockAuditDocument];

      model.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggregateResult),
      } as any);

      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockRecentActivity),
          }),
        }),
      } as any);

      const result = await repository.getStatistics();

      expect(result).toEqual({
        totalOperations: 100,
        operationCounts: {
          CREATE: 50,
          UPDATE: 30,
          DELETE: 20,
        },
        topUsers: [
          { userId: 'user1', count: 40 },
          { userId: 'user2', count: 30 },
        ],
        topConfigs: [
          { configKey: 'config1', count: 25 },
          { configKey: 'config2', count: 20 },
        ],
        recentActivity: mockRecentActivity,
      });
    });

    it('should handle empty statistics', async () => {
      const mockAggregateResult = [
        {
          totalOperations: [],
          operationCounts: [],
          topUsers: [],
          topConfigs: [],
        },
      ];

      model.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggregateResult),
      } as any);

      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await repository.getStatistics();

      expect(result.totalOperations).toBe(0);
      expect(result.operationCounts).toEqual({});
      expect(result.topUsers).toEqual([]);
      expect(result.topConfigs).toEqual([]);
      expect(result.recentActivity).toEqual([]);
    });
  });

  describe('findWithFilterPaginated', () => {
    it('should find audit logs with no filter', async () => {
      const mockExec = jest.fn().mockResolvedValue([mockAuditDocument]);
      const mockCountExec = jest.fn().mockResolvedValue(1);

      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({
        exec: mockCountExec,
      } as any);

      const result = await repository.findWithFilterPaginated({});

      expect(model.find).toHaveBeenCalledWith({});
      expect(model.countDocuments).toHaveBeenCalledWith({});
      expect(result).toEqual({ logs: [mockAuditDocument], total: 1 });
    });

    it('should find audit logs with filter and custom pagination', async () => {
      const filter: AuditFilter = {
        configKey: 'test.key',
        userId: 'user123',
        operation: 'CREATE',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
      };

      const expectedQuery = {
        configKey: 'test.key',
        userId: 'user123',
        operation: 'CREATE',
        timestamp: {
          $gte: filter.startDate,
          $lte: filter.endDate,
        },
      };

      const mockExec = jest.fn().mockResolvedValue([mockAuditDocument]);
      const mockCountExec = jest.fn().mockResolvedValue(1);

      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({
        exec: mockCountExec,
      } as any);

      const result = await repository.findWithFilterPaginated(filter, 20, 10);

      expect(model.find).toHaveBeenCalledWith(expectedQuery);
      expect(model.countDocuments).toHaveBeenCalledWith(expectedQuery);

      // Verify pagination parameters
      const sortMock = model.find().sort as jest.Mock;
      const skipMock = sortMock().skip as jest.Mock;
      const limitMock = skipMock().limit as jest.Mock;

      expect(skipMock).toHaveBeenCalledWith(10);
      expect(limitMock).toHaveBeenCalledWith(20);

      expect(result).toEqual({ logs: [mockAuditDocument], total: 1 });
    });

    it('should handle database errors', async () => {
      const mockExec = jest.fn().mockRejectedValue(new Error('Database error'));
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: mockExec,
            }),
          }),
        }),
      } as any);

      model.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      } as any);

      await expect(repository.findWithFilterPaginated({})).rejects.toThrow('Database error');
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete old logs successfully', async () => {
      const olderThan = new Date('2023-01-01');
      const mockExec = jest.fn().mockResolvedValue({ deletedCount: 10 });

      model.deleteMany.mockReturnValue({
        exec: mockExec,
      } as any);

      const result = await repository.deleteOlderThan(olderThan);

      expect(model.deleteMany).toHaveBeenCalledWith({ timestamp: { $lt: olderThan } });
      expect(result).toBe(10);
    });

    it('should handle cleanup errors', async () => {
      const olderThan = new Date('2023-01-01');
      const mockExec = jest.fn().mockRejectedValue(new Error('Cleanup error'));

      model.deleteMany.mockReturnValue({
        exec: mockExec,
      } as any);

      await expect(repository.deleteOlderThan(olderThan)).rejects.toThrow('Cleanup error');
    });
  });

  describe('count', () => {
    it('should count all audit logs when no filter provided', async () => {
      model.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(100),
      } as any);

      const result = await repository.count();

      expect(model.countDocuments).toHaveBeenCalledWith({});
      expect(result).toBe(100);
    });

    it('should count audit logs with filter', async () => {
      const filter: AuditFilter = {
        configKey: 'test.key',
        userId: 'user123',
      };

      const expectedQuery = {
        configKey: 'test.key',
        userId: 'user123',
      };

      model.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(50),
      } as any);

      const result = await repository.count(filter);

      expect(model.countDocuments).toHaveBeenCalledWith(expectedQuery);
      expect(result).toBe(50);
    });
  });

  describe('healthCheck', () => {
    it('should return true when database is healthy', async () => {
      model.findOne.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockAuditDocument),
        }),
      } as any);

      const result = await repository.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when database is unhealthy', async () => {
      model.findOne.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const result = await repository.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('buildQuery', () => {
    it('should build query with all filter options', () => {
      const filter: AuditFilter = {
        configKey: 'test.key',
        userId: 'user123',
        operation: 'CREATE',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
      };

      // Access the private method for testing
      const buildQuery = (repository as any).buildQuery.bind(repository);
      const result = buildQuery(filter);

      expect(result).toEqual({
        configKey: 'test.key',
        userId: 'user123',
        operation: 'CREATE',
        timestamp: {
          $gte: filter.startDate,
          $lte: filter.endDate,
        },
      });
    });

    it('should build empty query when no filter provided', () => {
      const buildQuery = (repository as any).buildQuery.bind(repository);
      const result = buildQuery({});

      expect(result).toEqual({});
    });

    it('should build query with only date range', () => {
      const filter: AuditFilter = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
      };

      const buildQuery = (repository as any).buildQuery.bind(repository);
      const result = buildQuery(filter);

      expect(result).toEqual({
        timestamp: {
          $gte: filter.startDate,
          $lte: filter.endDate,
        },
      });
    });
  });
});
