import { Test, TestingModule } from '@nestjs/testing';

import {
  AuditFilter,
  AuditLogEntry,
  DynamicConfigAuditRepository,
} from '@/modules/dynamic-config/repositories/dynamic-config-audit.repository';
import { ConfigurationChangeEvent } from '@/modules/dynamic-config/services/dynamic-config.service';
import { DynamicConfigAuditService } from '@/modules/dynamic-config/services/dynamic-config-audit.service';

describe('DynamicConfigAuditService', () => {
  let service: DynamicConfigAuditService;
  let repository: jest.Mocked<DynamicConfigAuditRepository>;

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
    getMaskedOldValue: jest.fn().mockReturnValue('old-value'),
    getMaskedNewValue: jest.fn().mockReturnValue('new-value'),
  } as any;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findHistory: jest.fn(),
      findUserActivity: jest.fn(),
      getStatistics: jest.fn(),
      findWithFilterPaginated: jest.fn(),
      count: jest.fn(),
      deleteOlderThan: jest.fn(),
      healthCheck: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicConfigAuditService,
        {
          provide: DynamicConfigAuditRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DynamicConfigAuditService>(DynamicConfigAuditService);
    repository = module.get<DynamicConfigAuditRepository>(
      DynamicConfigAuditRepository,
    ) as jest.Mocked<DynamicConfigAuditRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditLog', () => {
    const auditEntry: AuditLogEntry = {
      configKey: 'test.key',
      operation: 'CREATE',
      newValue: 'test-value',
      userId: 'user123',
      userAgent: 'Mozilla/5.0',
      timestamp: new Date(),
    };

    it('should create audit log successfully', async () => {
      repository.create.mockResolvedValue(mockAuditDocument);

      const result = await service.createAuditLog(auditEntry);

      expect(repository.create).toHaveBeenCalledWith(auditEntry);
      expect(result).toEqual(mockAuditDocument);
    });

    it('should handle database errors', async () => {
      repository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createAuditLog(auditEntry)).rejects.toThrow('Database error');
    });
  });

  describe('getConfigurationHistory', () => {
    it('should get configuration history with default pagination', async () => {
      repository.findHistory.mockResolvedValue({
        logs: [mockAuditDocument],
        total: 1,
      });

      const result = await service.getConfigurationHistory('test.key');

      expect(repository.findHistory).toHaveBeenCalledWith('test.key', 50, 0);
      expect(result.logs).toEqual([mockAuditDocument]);
    });

    it('should get configuration history with custom pagination', async () => {
      repository.findHistory.mockResolvedValue({
        logs: [mockAuditDocument],
        total: 1,
      });

      const result = await service.getConfigurationHistory('test.key', 10, 5);

      expect(repository.findHistory).toHaveBeenCalledWith('test.key', 10, 5);
      expect(result.logs).toEqual([mockAuditDocument]);
    });

    it('should handle database errors', async () => {
      repository.findHistory.mockRejectedValue(new Error('Database error'));

      await expect(service.getConfigurationHistory('test.key')).rejects.toThrow('Database error');
    });
  });

  describe('getAuditLogs', () => {
    it('should get audit logs with no filter', async () => {
      repository.findWithFilterPaginated.mockResolvedValue({
        logs: [mockAuditDocument],
        total: 1,
      });

      repository.count.mockResolvedValue(1);

      const result = await service.getAuditLogs();

      expect(repository.findWithFilterPaginated).toHaveBeenCalledWith({}, 100, 0);
      expect(result).toEqual({
        logs: [mockAuditDocument],
        total: 1,
      });
    });

    it('should get audit logs with filter', async () => {
      const filter: AuditFilter = {
        configKey: 'test.key',
        userId: 'user123',
        operation: 'CREATE',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
      };

      repository.findWithFilterPaginated.mockResolvedValue({
        logs: [mockAuditDocument],
        total: 1,
      });

      repository.count.mockResolvedValue(1);

      const result = await service.getAuditLogs(filter, 50, 0);

      expect(repository.findWithFilterPaginated).toHaveBeenCalledWith(filter, 50, 0);
      expect(result).toEqual({
        logs: [mockAuditDocument],
        total: 1,
      });
    });
  });

  describe('getAuditStatistics', () => {
    it('should get audit statistics', async () => {
      const mockStatistics = {
        totalOperations: 100,
        operationCounts: {
          CREATE: 50,
          UPDATE: 30,
          DELETE: 20,
        },
        topUsers: [
          { userId: 'user1', count: 60 },
          { userId: 'user2', count: 40 },
        ],
        topConfigs: [
          { configKey: 'config1', count: 70 },
          { configKey: 'config2', count: 30 },
        ],
        recentActivity: [mockAuditDocument],
      };

      repository.getStatistics.mockResolvedValue(mockStatistics);

      const result = await service.getAuditStatistics();

      expect(repository.getStatistics).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(mockStatistics);
    });

    it('should handle empty statistics', async () => {
      const mockEmptyStatistics = {
        totalOperations: 0,
        operationCounts: {},
        topUsers: [],
        topConfigs: [],
        recentActivity: [],
      };

      repository.getStatistics.mockResolvedValue(mockEmptyStatistics);

      const result = await service.getAuditStatistics();

      expect(result.totalOperations).toBe(0);
      expect(result.operationCounts).toEqual({});
      expect(result.topUsers).toEqual([]);
      expect(result.topConfigs).toEqual([]);
      expect(result.recentActivity).toEqual([]);
    });
  });

  describe('getUserActivity', () => {
    it('should get user activity', async () => {
      repository.findUserActivity.mockResolvedValue({
        logs: [mockAuditDocument],
        total: 1,
      });

      const result = await service.getUserActivity('user123');

      expect(repository.findUserActivity).toHaveBeenCalledWith('user123', 50, 0);
      expect(result).toEqual([mockAuditDocument]);
    });
  });

  describe('cleanupOldLogs', () => {
    it('should cleanup old logs successfully', async () => {
      const olderThan = new Date('2023-01-01');
      repository.deleteOlderThan.mockResolvedValue(10);

      const result = await service.cleanupOldLogs(olderThan);

      expect(repository.deleteOlderThan).toHaveBeenCalledWith(olderThan);
      expect(result).toBe(10);
    });

    it('should handle cleanup errors', async () => {
      const olderThan = new Date('2023-01-01');
      repository.deleteOlderThan.mockRejectedValue(new Error('Cleanup error'));

      await expect(service.cleanupOldLogs(olderThan)).rejects.toThrow('Cleanup error');
    });
  });

  describe('handleConfigurationChange', () => {
    it('should handle configuration change event', async () => {
      const event: ConfigurationChangeEvent = {
        key: 'test.key',
        operation: 'UPDATE',
        oldValue: 'old-value',
        newValue: 'new-value',
        userId: 'user123',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
      };

      repository.create.mockResolvedValue(mockAuditDocument);

      await service.handleConfigurationChange(event);

      expect(repository.create).toHaveBeenCalledWith({
        configKey: event.key,
        operation: event.operation,
        oldValue: event.oldValue,
        newValue: event.newValue,
        userId: event.userId,
        userAgent: event.userAgent,
        timestamp: event.timestamp,
      });
    });

    it('should handle errors gracefully without throwing', async () => {
      const event: ConfigurationChangeEvent = {
        key: 'test.key',
        operation: 'CREATE',
        newValue: 'new-value',
        userId: 'user123',
        timestamp: new Date(),
      };

      repository.create.mockRejectedValue(new Error('Audit error'));

      // Should not throw
      await expect(service.handleConfigurationChange(event)).resolves.toBeUndefined();
    });
  });

  describe('exportAuditLogs', () => {
    beforeEach(() => {
      mockAuditDocument.getMaskedOldValue.mockReturnValue('masked-old');
      mockAuditDocument.getMaskedNewValue.mockReturnValue('masked-new');
    });

    it('should export audit logs as JSON', async () => {
      repository.findWithFilterPaginated.mockResolvedValue({
        logs: [mockAuditDocument],
        total: 1,
      });

      const result = await service.exportAuditLogs({});

      expect(repository.findWithFilterPaginated).toHaveBeenCalledWith({});
      expect(result).toContain('"configKey": "test.key"');
      expect(result).toContain('"operation": "CREATE"');
      expect(result).toContain('"oldValue": "masked-old"');
      expect(result).toContain('"newValue": "masked-new"');
    });
  });
});
