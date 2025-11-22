import { Test, TestingModule } from '@nestjs/testing';

import * as api from '@opentelemetry/api';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { MetricsRegistryService } from '@/modules/opentelemetry/metrics-registry.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { FulfillmentStrategyName } from '../../types/strategy-name.type';
import { createMockIntent } from '../../validations/test-helpers';
import { IntentProcessingService } from '../intent-processing.service';
import { StrategyManagementService } from '../strategy-management.service';

describe('IntentProcessingService', () => {
  let service: IntentProcessingService;
  let strategyManagement: jest.Mocked<StrategyManagementService>;
  let intentsService: jest.Mocked<IntentsService>;
  let logger: jest.Mocked<SystemLoggerService>;
  let mockSpan: any;

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockOtelService = {
    tracer: {
      startActiveSpan: jest.fn(),
    },
    startSpan: jest.fn(),
  };

  const mockStrategyManagement = {
    getStrategy: jest.fn(),
  };

  const mockIntentsService = {
    updateStatus: jest.fn(),
  };

  const mockMetricsRegistry = {
    recordIntentAttempted: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock span
    mockSpan = {
      setAttributes: jest.fn(),
      setAttribute: jest.fn(),
      addEvent: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    };

    // Setup startActiveSpan to call the callback with mock span
    mockOtelService.tracer.startActiveSpan.mockImplementation((name, options, fn) => {
      return fn(mockSpan);
    });

    // Setup startSpan to return mock span
    mockOtelService.startSpan.mockReturnValue(mockSpan);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentProcessingService,
        {
          provide: SystemLoggerService,
          useValue: mockLogger,
        },
        {
          provide: StrategyManagementService,
          useValue: mockStrategyManagement,
        },
        {
          provide: IntentsService,
          useValue: mockIntentsService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
        {
          provide: MetricsRegistryService,
          useValue: mockMetricsRegistry,
        },
      ],
    }).compile();

    service = module.get<IntentProcessingService>(IntentProcessingService);
    strategyManagement = module.get(StrategyManagementService);
    intentsService = module.get(IntentsService);
    logger = module.get(SystemLoggerService);
  });

  describe('processIntent with fulfilledEvent', () => {
    it('should skip processing when fulfilledEvent exists', async () => {
      const fulfilledIntent = createMockIntent({
        fulfilledEvent: {
          claimant: '0x1234567890123456789012345678901234567890',
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          blockNumber: '12345678',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          chainId: '10',
        },
      });

      const strategyName: FulfillmentStrategyName = 'standard';

      // Mock strategy that should NOT be called
      const mockStrategy = {
        validate: jest.fn(),
        execute: jest.fn(),
        canHandle: jest.fn().mockReturnValue(true),
      };
      strategyManagement.getStrategy.mockReturnValue(mockStrategy as any);

      // Process the fulfilled intent
      await service.processIntent(fulfilledIntent, strategyName);

      // Verify strategy was not retrieved (early return)
      expect(strategyManagement.getStrategy).not.toHaveBeenCalled();

      // Verify no validation or execution occurred
      expect(mockStrategy.validate).not.toHaveBeenCalled();
      expect(mockStrategy.execute).not.toHaveBeenCalled();

      // Verify intent status was not updated
      expect(intentsService.updateStatus).not.toHaveBeenCalled();

      // Verify appropriate logging
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('has already been fulfilled'),
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        ),
      );
    });

    it('should process normally when fulfilledEvent is undefined', async () => {
      const unfulfilledIntent = createMockIntent({
        fulfilledEvent: undefined,
      });

      const strategyName: FulfillmentStrategyName = 'standard';

      const mockStrategy = {
        validate: jest.fn().mockResolvedValue(true),
        execute: jest.fn().mockResolvedValue(undefined),
        canHandle: jest.fn().mockReturnValue(true),
      };
      strategyManagement.getStrategy.mockReturnValue(mockStrategy as any);
      intentsService.updateStatus.mockResolvedValue(undefined as any);

      await service.processIntent(unfulfilledIntent, strategyName);

      // Verify normal processing occurred
      expect(strategyManagement.getStrategy).toHaveBeenCalledWith(strategyName);
      expect(mockStrategy.validate).toHaveBeenCalled();
      expect(mockStrategy.execute).toHaveBeenCalled();

      // Verify status updates occurred (VALIDATING first, then EXECUTING)
      expect(intentsService.updateStatus).toHaveBeenCalledTimes(2);
      expect(intentsService.updateStatus).toHaveBeenNthCalledWith(
        1,
        unfulfilledIntent.intentHash,
        IntentStatus.VALIDATING,
      );
      expect(intentsService.updateStatus).toHaveBeenNthCalledWith(
        2,
        unfulfilledIntent.intentHash,
        IntentStatus.EXECUTING,
      );
    });

    it('should include fulfilledEvent details in span attributes', async () => {
      const fulfilledIntent = createMockIntent({
        fulfilledEvent: {
          claimant: '0xclaimant',
          txHash: '0xtxhash',
          blockNumber: '999',
          timestamp: new Date('2024-06-01T12:00:00Z'),
          chainId: '8453',
        },
      });

      await service.processIntent(fulfilledIntent, 'standard');

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'intent.already_fulfilled': true,
          'intent.fulfilled.chain': '8453',
          'intent.fulfilled.tx_hash': '0xtxhash',
          'intent.fulfilled.claimant': '0xclaimant',
          'intent.fulfilled.timestamp': '2024-06-01T12:00:00.000Z',
        }),
      );

      expect(mockSpan.addEvent).toHaveBeenCalledWith('intent.processing.skipped', {
        reason: 'already_fulfilled',
      });

      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: api.SpanStatusCode.OK });
    });

    it('should not call metrics registry when intent is already fulfilled', async () => {
      const fulfilledIntent = createMockIntent({
        fulfilledEvent: {
          claimant: '0x1234567890123456789012345678901234567890',
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          blockNumber: '12345678',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          chainId: '10',
        },
      });

      await service.processIntent(fulfilledIntent, 'standard');

      // Verify metrics were not recorded
      expect(mockMetricsRegistry.recordIntentAttempted).not.toHaveBeenCalled();
    });

    it('should end span properly when skipping fulfilled intent', async () => {
      const fulfilledIntent = createMockIntent({
        fulfilledEvent: {
          claimant: '0x1234567890123456789012345678901234567890',
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          blockNumber: '12345678',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          chainId: '10',
        },
      });

      await service.processIntent(fulfilledIntent, 'standard');

      // Verify span was ended
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });
});
