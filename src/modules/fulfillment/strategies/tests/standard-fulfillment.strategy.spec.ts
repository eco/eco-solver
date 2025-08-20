import { Test } from '@nestjs/testing';

// Mock the dependencies before any imports
jest.mock('@/modules/blockchain/blockchain-executor.service', () => ({
  BlockchainExecutorService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/modules/blockchain/blockchain-reader.service', () => ({
  BlockchainReaderService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/modules/queue/queue.service', () => ({
  QueueService: jest.fn().mockImplementation(() => ({
    addIntentToExecutionQueue: jest.fn(),
  })),
}));

jest.mock('@/modules/opentelemetry/opentelemetry.service', () => ({
  OpenTelemetryService: jest.fn().mockImplementation(() => ({
    startSpan: jest.fn().mockReturnValue({
      setAttribute: jest.fn(),
      setAttributes: jest.fn(),
      addEvent: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    }),
    getActiveSpan: jest.fn(),
  })),
}));

import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import {
  ChainSupportValidation,
  DuplicateRewardTokensValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  IntentFundedValidation,
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteTokenValidation,
  StandardFeeValidation,
} from '@/modules/fulfillment/validations';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { StandardFulfillmentStrategy } from '../standard-fulfillment.strategy';

describe('StandardFulfillmentStrategy', () => {
  let strategy: StandardFulfillmentStrategy;
  let _blockchainExecutorService: jest.Mocked<BlockchainExecutorService>;
  let _blockchainReaderService: jest.Mocked<BlockchainReaderService>;
  let queueService: jest.Mocked<QueueService>;
  let _otelService: jest.Mocked<OpenTelemetryService>;

  // Mock validation services
  let intentFundedValidation: jest.Mocked<IntentFundedValidation>;
  let duplicateRewardTokensValidation: jest.Mocked<any>;
  let routeTokenValidation: jest.Mocked<RouteTokenValidation>;
  let routeCallsValidation: jest.Mocked<RouteCallsValidation>;
  let routeAmountLimitValidation: jest.Mocked<RouteAmountLimitValidation>;
  let expirationValidation: jest.Mocked<ExpirationValidation>;
  let chainSupportValidation: jest.Mocked<ChainSupportValidation>;
  let proverSupportValidation: jest.Mocked<ProverSupportValidation>;
  let executorBalanceValidation: jest.Mocked<ExecutorBalanceValidation>;
  let standardFeeValidation: jest.Mocked<StandardFeeValidation>;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock services
    const mockBlockchainExecutorService = {};
    const mockBlockchainReaderService = {};
    const mockQueueService = {
      addIntentToExecutionQueue: jest.fn(),
    };
    const mockOtelService = {
      startSpan: jest.fn().mockReturnValue({
        setAttribute: jest.fn(),
        setAttributes: jest.fn(),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      }),
      getActiveSpan: jest.fn(),
    };

    // Create mock validations
    const createMockValidation = (name: string) => ({
      validate: jest.fn().mockResolvedValue(true),
      constructor: { name },
    });

    intentFundedValidation = createMockValidation('IntentFundedValidation') as any;
    duplicateRewardTokensValidation = createMockValidation('DuplicateRewardTokensValidation') as any;
    routeTokenValidation = createMockValidation('RouteTokenValidation') as any;
    routeCallsValidation = createMockValidation('RouteCallsValidation') as any;
    routeAmountLimitValidation = createMockValidation('RouteAmountLimitValidation') as any;
    expirationValidation = createMockValidation('ExpirationValidation') as any;
    chainSupportValidation = createMockValidation('ChainSupportValidation') as any;
    proverSupportValidation = createMockValidation('ProverSupportValidation') as any;
    executorBalanceValidation = createMockValidation('ExecutorBalanceValidation') as any;
    standardFeeValidation = createMockValidation('StandardFeeValidation') as any;

    const module = await Test.createTestingModule({
      providers: [
        StandardFulfillmentStrategy,
        {
          provide: BlockchainExecutorService,
          useValue: mockBlockchainExecutorService,
        },
        {
          provide: BlockchainReaderService,
          useValue: mockBlockchainReaderService,
        },
        {
          provide: QUEUE_SERVICE,
          useValue: mockQueueService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
        {
          provide: IntentFundedValidation,
          useValue: intentFundedValidation,
        },
        {
          provide: DuplicateRewardTokensValidation,
          useValue: duplicateRewardTokensValidation,
        },
        {
          provide: RouteTokenValidation,
          useValue: routeTokenValidation,
        },
        {
          provide: RouteCallsValidation,
          useValue: routeCallsValidation,
        },
        {
          provide: RouteAmountLimitValidation,
          useValue: routeAmountLimitValidation,
        },
        {
          provide: ExpirationValidation,
          useValue: expirationValidation,
        },
        {
          provide: ChainSupportValidation,
          useValue: chainSupportValidation,
        },
        {
          provide: ProverSupportValidation,
          useValue: proverSupportValidation,
        },
        {
          provide: ExecutorBalanceValidation,
          useValue: executorBalanceValidation,
        },
        {
          provide: StandardFeeValidation,
          useValue: standardFeeValidation,
        },
      ],
    }).compile();

    strategy = module.get<StandardFulfillmentStrategy>(StandardFulfillmentStrategy);
    _blockchainExecutorService = module.get(BlockchainExecutorService);
    _blockchainReaderService = module.get(BlockchainReaderService);
    queueService = module.get(QUEUE_SERVICE);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(strategy.name).toBe(FULFILLMENT_STRATEGY_NAMES.STANDARD);
    });

    it('should have the correct validations in order', () => {
      const validations = (strategy as any).getValidations();
      expect(validations).toHaveLength(10);
      expect(validations[0]).toBe(intentFundedValidation);
      expect(validations[1]).toBe(duplicateRewardTokensValidation);
      expect(validations[2]).toBe(routeTokenValidation);
      expect(validations[3]).toBe(routeCallsValidation);
      expect(validations[4]).toBe(routeAmountLimitValidation);
      expect(validations[5]).toBe(expirationValidation);
      expect(validations[6]).toBe(chainSupportValidation);
      expect(validations[7]).toBe(proverSupportValidation);
      expect(validations[8]).toBe(executorBalanceValidation);
      expect(validations[9]).toBe(standardFeeValidation);
    });

    it('should have immutable validations array', () => {
      const validations = (strategy as any).getValidations();
      expect(() => {
        (validations as any).push({});
      }).toThrow();
      expect(() => {
        (validations as any)[0] = {};
      }).toThrow();
    });
  });

  describe('canHandle', () => {
    it('should always return true for any intent', () => {
      const mockIntent = createMockIntent();
      expect(strategy.canHandle(mockIntent)).toBe(true);
    });

    it('should return true for intents with different configurations', () => {
      const intents = [
        createMockIntent({ route: { source: BigInt(1), destination: BigInt(10) } as any }),
        createMockIntent({ route: { source: BigInt(137), destination: BigInt(42161) } as any }),
        createMockIntent({
          reward: {
            nativeValue: BigInt(0),
            tokens: [{ amount: BigInt(1000), token: '0x123' as any }],
          } as any,
        }),
      ];

      intents.forEach((intent) => {
        expect(strategy.canHandle(intent)).toBe(true);
      });
    });
  });

  describe('validate', () => {
    it('should run all validations in order', async () => {
      const mockIntent = createMockIntent();
      const result = await strategy.validate(mockIntent);

      expect(result).toBe(true);

      // Verify all validations were called
      expect(intentFundedValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(routeTokenValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(routeCallsValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(expirationValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(chainSupportValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(proverSupportValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(executorBalanceValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(standardFeeValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );

      // Verify each validation was called exactly once
      [
        intentFundedValidation,
        routeTokenValidation,
        routeCallsValidation,
        routeAmountLimitValidation,
        expirationValidation,
        chainSupportValidation,
        proverSupportValidation,
        executorBalanceValidation,
        standardFeeValidation,
      ].forEach((validation) => {
        expect(validation.validate).toHaveBeenCalledTimes(1);
      });
    });

    it('should throw aggregated error on validation failure', async () => {
      const mockIntent = createMockIntent();

      // Make the third validation (routeTokenValidation) fail
      routeTokenValidation.validate.mockResolvedValue(false);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failures: Validation failed: RouteTokenValidation',
      );

      // Verify all validations were called (parallel execution)
      expect(intentFundedValidation.validate).toHaveBeenCalledTimes(1);
      expect(duplicateRewardTokensValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeTokenValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeCallsValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledTimes(1);
      expect(expirationValidation.validate).toHaveBeenCalledTimes(1);
      expect(chainSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(proverSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(executorBalanceValidation.validate).toHaveBeenCalledTimes(1);
      expect(standardFeeValidation.validate).toHaveBeenCalledTimes(1);
    });

    it('should propagate validation errors', async () => {
      const mockIntent = createMockIntent();
      const validationError = new Error('Custom validation error');

      intentFundedValidation.validate.mockRejectedValue(validationError);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failures: Custom validation error',
      );
    });

    it('should handle multiple validation failures correctly', async () => {
      const mockIntent = createMockIntent();

      // Make multiple validations return false
      routeTokenValidation.validate.mockResolvedValue(false);
      chainSupportValidation.validate.mockResolvedValue(false);

      // Should aggregate both failures
      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failures: Validation failed: RouteTokenValidation; Validation failed: ChainSupportValidation',
      );

      // All validations should have been called (parallel execution)
      expect(routeTokenValidation.validate).toHaveBeenCalledTimes(1);
      expect(chainSupportValidation.validate).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute', () => {
    it('should add intent to execution queue with correct parameters', async () => {
      const mockIntent = createMockIntent();

      await strategy.execute(mockIntent);

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledWith({
        strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
        intent: mockIntent,
        chainId: mockIntent.route.destination,
        walletId: 'kernel',
      });
      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledTimes(1);
    });

    it('should propagate queue service errors', async () => {
      const mockIntent = createMockIntent();
      const queueError = new Error('Queue service error');

      queueService.addIntentToExecutionQueue.mockRejectedValue(queueError);

      await expect(strategy.execute(mockIntent)).rejects.toThrow(queueError);
    });

    it('should handle different intent configurations', async () => {
      const intents = [
        createMockIntent({ route: { source: BigInt(1), destination: BigInt(10) } as any }),
        createMockIntent({
          reward: {
            nativeValue: BigInt(0),
            tokens: [{ amount: BigInt(1000), token: '0x123' as any }],
          } as any,
        }),
        createMockIntent({ status: 'VALIDATED' as any }),
      ];

      for (const intent of intents) {
        await strategy.execute(intent);
      }

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledTimes(3);
      intents.forEach((intent, index) => {
        expect(queueService.addIntentToExecutionQueue).toHaveBeenNthCalledWith(index + 1, {
          strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
          intent,
          chainId: intent.route.destination,
          walletId: 'kernel',
        });
      });
    });
  });

  describe('getValidations', () => {
    it('should return the correct validations array', () => {
      const validations = (strategy as any).getValidations();

      expect(Array.isArray(validations)).toBe(true);
      expect(validations).toHaveLength(10);
      expect(Object.isFrozen(validations)).toBe(true);
    });
  });
});
