import { Test, TestingModule } from '@nestjs/testing';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { FulfillmentStrategyName } from '../../types/strategy-name.type';
import { createMockIntent } from '../../validations/test-helpers';
import { IntentProcessingService } from '../intent-processing.service';
import { StrategyManagementService } from '../strategy-management.service';

describe('IntentProcessingService', () => {
  let service: IntentProcessingService;
  let strategyManagement: jest.Mocked<StrategyManagementService>;
  let intentsService: jest.Mocked<IntentsService>;
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
      ],
    }).compile();

    service = module.get<IntentProcessingService>(IntentProcessingService);
    strategyManagement = module.get(StrategyManagementService);
    intentsService = module.get(IntentsService);
  });

  describe('processIntent', () => {
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
  });
});
