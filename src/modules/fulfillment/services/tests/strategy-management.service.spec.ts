import { Test, TestingModule } from '@nestjs/testing';

import { Intent } from '@/common/interfaces/intent.interface';
import { SystemLoggerService } from '@/common/services/system-logger.service';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { CrowdLiquidityFulfillmentStrategy } from '../../strategies/crowd-liquidity-fulfillment.strategy';
import { NativeIntentsFulfillmentStrategy } from '../../strategies/native-intents-fulfillment.strategy';
import { NegativeIntentsFulfillmentStrategy } from '../../strategies/negative-intents-fulfillment.strategy';
import { RhinestoneFulfillmentStrategy } from '../../strategies/rhinestone-fulfillment.strategy';
import { StandardFulfillmentStrategy } from '../../strategies/standard-fulfillment.strategy';
import { createMockIntent } from '../../validations/test-helpers';
import { StrategyManagementService } from '../strategy-management.service';

describe('StrategyManagementService', () => {
  let service: StrategyManagementService;
  let configService: FulfillmentConfigService;
  let standardStrategy: StandardFulfillmentStrategy;

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const mockOtelService = {
    startSpan: jest.fn().mockReturnValue({
      setAttribute: jest.fn(),
      setAttributes: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    }),
  };

  const mockConfigService = {
    getStrategiesConfig: jest.fn().mockReturnValue({
      standard: { enabled: true },
      'crowd-liquidity': { enabled: false },
      'native-intents': { enabled: true },
      'negative-intents': { enabled: false },
      rhinestone: { enabled: false },
    }),
    getDefaultStrategy: jest.fn().mockReturnValue('standard'),
  };

  const createMockStrategy = (name: string, canHandle: boolean = true) => ({
    name,
    validate: jest.fn().mockResolvedValue(true),
    execute: jest.fn().mockResolvedValue(undefined),
    canHandle: jest.fn().mockReturnValue(canHandle),
    getQuote: jest.fn(),
    getWalletIdForIntent: jest.fn().mockResolvedValue('basic'),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategyManagementService,
        { provide: SystemLoggerService, useValue: mockLogger },
        { provide: FulfillmentConfigService, useValue: mockConfigService },
        { provide: OpenTelemetryService, useValue: mockOtelService },
        { provide: StandardFulfillmentStrategy, useValue: createMockStrategy('standard') },
        {
          provide: CrowdLiquidityFulfillmentStrategy,
          useValue: createMockStrategy('crowd-liquidity'),
        },
        {
          provide: NativeIntentsFulfillmentStrategy,
          useValue: createMockStrategy('native-intents'),
        },
        {
          provide: NegativeIntentsFulfillmentStrategy,
          useValue: createMockStrategy('negative-intents'),
        },
        { provide: RhinestoneFulfillmentStrategy, useValue: createMockStrategy('rhinestone') },
      ],
    }).compile();

    service = module.get<StrategyManagementService>(StrategyManagementService);
    configService = module.get<FulfillmentConfigService>(FulfillmentConfigService);
    standardStrategy = module.get<StandardFulfillmentStrategy>(StandardFulfillmentStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize strategies based on configuration', async () => {
      await service.onModuleInit();

      expect(mockLogger.log).toHaveBeenCalledWith("Strategy 'standard' registered and enabled");
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Strategy 'crowd-liquidity' registered but disabled",
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Strategy 'native-intents' registered and enabled",
      );
    });
  });

  describe('getStrategy', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return strategy if enabled', () => {
      const strategy = service.getStrategy('standard');
      expect(strategy).toBeDefined();
      expect(strategy?.name).toBe('standard');
    });

    it('should return undefined for disabled strategy', () => {
      const strategy = service.getStrategy('crowd-liquidity');
      expect(strategy).toBeUndefined();
    });

    it('should return undefined for unknown strategy', () => {
      const strategy = service.getStrategy('unknown');
      expect(strategy).toBeUndefined();
    });
  });

  describe('getStrategiesForIntent', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return strategies that can handle the intent', () => {
      const intent = createMockIntent();
      const strategies = service.getStrategiesForIntent(intent);

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0].name).toBe('standard');
    });

    it('should filter out disabled strategies', () => {
      const intent = createMockIntent();
      const strategies = service.getStrategiesForIntent(intent);

      const strategyNames = strategies.map((s) => s.name);
      expect(strategyNames).toContain('standard');
      expect(strategyNames).toContain('native-intents');
      expect(strategyNames).not.toContain('crowd-liquidity');
    });

    it('should sort strategies by priority', () => {
      const intent = createMockIntent();
      const strategies = service.getStrategiesForIntent(intent);

      // Standard has highest priority (100), native-intents has 90
      expect(strategies[0].name).toBe('standard');
      if (strategies.length > 1) {
        expect(strategies[1].name).toBe('native-intents');
      }
    });
  });

  describe('isStrategyEnabled', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return true for enabled strategy', () => {
      expect(service.isStrategyEnabled('standard')).toBe(true);
    });

    it('should return false for disabled strategy', () => {
      expect(service.isStrategyEnabled('crowd-liquidity')).toBe(false);
    });

    it('should return false for unknown strategy', () => {
      expect(service.isStrategyEnabled('unknown')).toBe(false);
    });
  });

  describe('getDefaultStrategy', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return the default strategy', () => {
      const strategy = service.getDefaultStrategy();
      expect(strategy).toBeDefined();
      expect(strategy?.name).toBe('standard');
    });
  });

  describe('register and unregister', () => {
    it('should register a new strategy', () => {
      const customStrategy = createMockStrategy('custom');
      const metadata = {
        name: 'custom',
        priority: 50,
        enabled: true,
        description: 'Custom strategy',
      };

      service.register(customStrategy as any, metadata);

      const strategy = service.getStrategy('custom');
      expect(strategy).toBeDefined();
      expect(strategy?.name).toBe('custom');
    });

    it('should unregister a strategy', async () => {
      await service.onModuleInit();

      service.unregister('standard');

      const strategy = service.getStrategy('standard');
      expect(strategy).toBeUndefined();
      expect(mockLogger.log).toHaveBeenCalledWith("Strategy 'standard' unregistered");
    });
  });
});
