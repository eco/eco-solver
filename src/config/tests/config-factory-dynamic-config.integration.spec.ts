import { ConfigFactory } from '@/config/config-factory';
import { DynamicConfigService } from '@/modules/dynamic-config/services/dynamic-config.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModuleRef } from '@nestjs/core';
import { ModuleRefProvider } from '@/common/services/module-ref-provider';
import { Test, TestingModule } from '@nestjs/testing';

describe('ConfigFactory + DynamicConfigService Integration', () => {
  let configFactory: typeof ConfigFactory;
  let dynamicConfigService: jest.Mocked<DynamicConfigService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let moduleRef: jest.Mocked<ModuleRef>;

  const mockConfigurations = {
    'database.host': 'mongodb://localhost:27017',
    'api.timeout': 5000,
    'feature.enabled': true,
    'secret.key': 'super-secret-value',
  };

  beforeEach(async () => {
    // Create mocks
    const mockDynamicConfigService = {
      getAll: jest.fn().mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
      get: jest.fn(),
      exists: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      onModuleInit: jest.fn(),
    };

    const mockEventEmitter = {
      on: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
    };

    const mockModuleRef = {
      get: jest.fn(),
    };

    // Setup module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DynamicConfigService,
          useValue: mockDynamicConfigService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
      ],
    }).compile();

    dynamicConfigService = module.get<DynamicConfigService>(
      DynamicConfigService,
    ) as jest.Mocked<DynamicConfigService>;
    eventEmitter = module.get<EventEmitter2>(EventEmitter2) as jest.Mocked<EventEmitter2>;
    moduleRef = module.get<ModuleRef>(ModuleRef) as jest.Mocked<ModuleRef>;

    // Setup ModuleRefProvider
    ModuleRefProvider.setModuleRef(moduleRef);

    // Setup moduleRef.get to return our mocked services
    moduleRef.get.mockImplementation((token: any) => {
      if (token === DynamicConfigService) {
        return dynamicConfigService;
      }
      if (token === EventEmitter2) {
        return eventEmitter;
      }
      return null;
    });

    configFactory = ConfigFactory;

    // Reset any cached state
    (configFactory as any).configurationService = null;
    (configFactory as any).eventEmitter = null;
    (configFactory as any).mongoConfig = {};
    (configFactory as any).cachedConfig = null;
  });

  afterEach(() => {
    // Reset ConfigFactory state
    (configFactory as any).configurationService = null;
    (configFactory as any).eventEmitter = null;
    (configFactory as any).mongoConfig = {};
    (configFactory as any).cachedConfig = null;

    // Reset mocks but keep the default implementation
    dynamicConfigService.getAll.mockReset();
    dynamicConfigService.getAll.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    eventEmitter.on.mockReset();
    eventEmitter.emit.mockReset();
    eventEmitter.removeListener.mockReset();

    moduleRef.get.mockReset();
    moduleRef.get.mockImplementation((token: any) => {
      if (token === DynamicConfigService) {
        return dynamicConfigService;
      }
      if (token === EventEmitter2) {
        return eventEmitter;
      }
      return null;
    });
  });

  describe('Dynamic Config Integration', () => {
    it('should connect to DynamicConfigService successfully', async () => {
      // Setup mock to return configurations
      dynamicConfigService.getAll.mockResolvedValue({
        data: Object.entries(mockConfigurations).map(([key, value]) => ({
          key,
          value,
          type: typeof value as any,
          isRequired: false,
          description: `Test config for ${key}`,
          lastModified: new Date(),
        })),
        pagination: {
          page: 1,
          limit: 50,
          total: 4,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      // Connect to dynamic config
      await configFactory.connectDynamicConfig();

      // Verify connection
      expect(configFactory.isMongoConfigurationEnabled()).toBe(true);
      expect(moduleRef.get).toHaveBeenCalledWith(DynamicConfigService, { strict: false });
      expect(moduleRef.get).toHaveBeenCalledWith(EventEmitter2, { strict: false });
    });

    it('should load MongoDB configurations and merge them', async () => {
      // Setup mock configurations
      dynamicConfigService.getAll.mockResolvedValue({
        data: [
          {
            key: 'database.host',
            value: 'mongodb://mongo-server:27017',
            type: 'string' as any,
            isRequired: true,
            description: 'Database host',
            lastModified: new Date(),
          },
          {
            key: 'api.timeout',
            value: 10000,
            type: 'number' as any,
            isRequired: false,
            description: 'API timeout',
            lastModified: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      // Connect and load config
      await configFactory.connectDynamicConfig();

      // Verify MongoDB configurations are loaded
      const mongoConfigs = configFactory.getMongoConfigurations();
      expect(mongoConfigs).toEqual({
        'database.host': 'mongodb://mongo-server:27017',
        'api.timeout': 10000,
      });

      expect(dynamicConfigService.getAll).toHaveBeenCalled();
    });

    it('should handle configuration change events', async () => {
      // Setup initial connection
      await configFactory.connectDynamicConfig();

      // Verify event listener is set up
      expect(eventEmitter.on).toHaveBeenCalledWith('configuration.changed', expect.any(Function));

      // Get the event handler that was registered
      const eventCall = eventEmitter.on.mock.calls.find(
        (call) => call[0] === 'configuration.changed',
      );
      expect(eventCall).toBeDefined();
      const eventHandler = eventCall![1];

      // Simulate a configuration change event
      const changeEvent = {
        key: 'new.config',
        operation: 'CREATE' as const,
        newValue: 'new-value',
        oldValue: undefined,
        userId: 'test-user',
        timestamp: new Date(),
        source: 'api' as const,
      };

      // Call the event handler
      eventHandler(changeEvent);

      // Verify the configuration was updated in mongoConfig
      const mongoConfigs = configFactory.getMongoConfigurations();
      expect(mongoConfigs['new.config']).toBe('new-value');
    });

    it('should handle configuration update events', async () => {
      // Setup initial configuration
      (configFactory as any).mongoConfig = {
        'existing.config': 'old-value',
      };

      await configFactory.connectDynamicConfig();

      // Get the event handler
      const eventCall = eventEmitter.on.mock.calls.find(
        (call) => call[0] === 'configuration.changed',
      );
      expect(eventCall).toBeDefined();
      const eventHandler = eventCall![1];

      // Simulate an update event
      const updateEvent = {
        key: 'existing.config',
        operation: 'UPDATE' as const,
        newValue: 'updated-value',
        oldValue: 'old-value',
        userId: 'test-user',
        timestamp: new Date(),
        source: 'api' as const,
      };

      eventHandler(updateEvent);

      // Verify the configuration was updated
      const mongoConfigs = configFactory.getMongoConfigurations();
      expect(mongoConfigs['existing.config']).toBe('updated-value');
    });

    it('should handle configuration delete events', async () => {
      // Setup mock to return initial configurations
      dynamicConfigService.getAll.mockResolvedValue({
        data: [
          {
            key: 'config.to.delete',
            value: 'some-value',
            type: 'string' as any,
            isRequired: false,
            description: 'Config to delete',
            lastModified: new Date(),
          },
          {
            key: 'config.to.keep',
            value: 'keep-this',
            type: 'string' as any,
            isRequired: false,
            description: 'Config to keep',
            lastModified: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      await configFactory.connectDynamicConfig();

      // Get the event handler
      const eventCall = eventEmitter.on.mock.calls.find(
        (call) => call[0] === 'configuration.changed',
      );
      expect(eventCall).toBeDefined();
      const eventHandler = eventCall![1];

      // Simulate a delete event
      const deleteEvent = {
        key: 'config.to.delete',
        operation: 'DELETE' as const,
        newValue: undefined,
        oldValue: 'some-value',
        userId: 'test-user',
        timestamp: new Date(),
        source: 'api' as const,
      };

      eventHandler(deleteEvent);

      // Verify the configuration was deleted
      const mongoConfigs = configFactory.getMongoConfigurations();
      expect(mongoConfigs['config.to.delete']).toBeUndefined();
      expect(mongoConfigs['config.to.keep']).toBe('keep-this');
    });

    it('should return configuration sources correctly', async () => {
      // Test without dynamic config
      let sources = configFactory.getConfigurationSources();
      expect(sources.mongodb).toBe(false);
      expect(sources.mongoConfigCount).toBe(0);

      // Setup and connect dynamic config
      dynamicConfigService.getAll.mockResolvedValue({
        data: [
          {
            key: 'test.config',
            value: 'test-value',
            type: 'string' as any,
            isRequired: false,
            description: 'Test config',
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

      await configFactory.connectDynamicConfig();

      // Test with dynamic config
      sources = configFactory.getConfigurationSources();
      expect(sources.mongodb).toBe(true);
      expect(sources.mongoConfigCount).toBe(1);
    });

    it('should handle DynamicConfigService connection failure gracefully', async () => {
      // Setup moduleRef to return null (service not available)
      moduleRef.get.mockReturnValue(null);

      // Should not throw
      await expect(configFactory.connectDynamicConfig()).resolves.not.toThrow();

      // Should indicate MongoDB is not enabled
      expect(configFactory.isMongoConfigurationEnabled()).toBe(false);
      expect(configFactory.isEventEmitterEnabled()).toBe(false);
    });

    it('should propagate DynamicConfigService.getAll() failures', async () => {
      // Setup service to throw error
      dynamicConfigService.getAll.mockRejectedValue(new Error('Database connection failed'));

      // Should throw during connection since there's no error handling
      await expect(configFactory.connectDynamicConfig()).rejects.toThrow(
        'Database connection failed',
      );

      // MongoDB configs should remain empty
      const mongoConfigs = configFactory.getMongoConfigurations();
      expect(mongoConfigs).toEqual({});
    });

    it('should provide access to individual configuration values', async () => {
      // Setup configurations
      (configFactory as any).mongoConfig = {
        'database.host': 'mongodb://localhost:27017',
        'api.timeout': 5000,
      };

      // Mock the cachedConfig to include merged configurations
      (configFactory as any).cachedConfig = {
        'database.host': 'mongodb://localhost:27017',
        'api.timeout': 5000,
        'static.config': 'from-env',
      };

      // Test generic getter
      expect(configFactory.get('database.host')).toBe('mongodb://localhost:27017');
      expect(configFactory.get('api.timeout')).toBe(5000);
      expect(configFactory.get('static.config')).toBe('from-env');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed configuration change events', async () => {
      await configFactory.connectDynamicConfig();

      const eventCall = eventEmitter.on.mock.calls.find(
        (call) => call[0] === 'configuration.changed',
      );
      expect(eventCall).toBeDefined();
      const eventHandler = eventCall![1];

      // Test with malformed event (missing key)
      const malformedEvent = {
        operation: 'CREATE' as const,
        newValue: 'some-value',
        timestamp: new Date(),
      };

      // Should not throw
      expect(() => eventHandler(malformedEvent)).not.toThrow();

      // MongoDB configs should have an "undefined" key due to the malformed event
      // TODO: ConfigFactory should validate event.key exists before processing
      // Current behavior: malformed events create "undefined" keys
      const mongoConfigs = configFactory.getMongoConfigurations();
      expect(mongoConfigs['undefined']).toBe('some-value');
      expect(Object.keys(mongoConfigs)).toHaveLength(1);
    });

    it('should handle unknown operation types in change events', async () => {
      await configFactory.connectDynamicConfig();

      const eventCall = eventEmitter.on.mock.calls.find(
        (call) => call[0] === 'configuration.changed',
      );
      expect(eventCall).toBeDefined();
      const eventHandler = eventCall![1];

      // Test with unknown operation
      const unknownEvent = {
        key: 'test.config',
        operation: 'UNKNOWN' as any,
        newValue: 'some-value',
        timestamp: new Date(),
      };

      // Should not throw
      expect(() => eventHandler(unknownEvent)).not.toThrow();
    });
  });
});
