import { Test } from '@nestjs/testing';

// Mock the dependencies before any imports
jest.mock('@/modules/blockchain/blockchain-executor.service', () => ({
  BlockchainExecutorService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/modules/queue/queue.service', () => ({
  QueueService: jest.fn().mockImplementation(() => ({
    addIntentToExecutionQueue: jest.fn(),
  })),
}));

import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';
import {
  ChainSupportValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  FundingValidation,
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
  let blockchainExecutorService: jest.Mocked<BlockchainExecutorService>;
  let queueService: jest.Mocked<QueueService>;

  // Mock validation services
  let fundingValidation: jest.Mocked<FundingValidation>;
  let intentFundedValidation: jest.Mocked<IntentFundedValidation>;
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
    const mockQueueService = {
      addIntentToExecutionQueue: jest.fn(),
    };

    // Create mock validations
    const createMockValidation = (name: string) => ({
      validate: jest.fn().mockResolvedValue(true),
      constructor: { name },
    });

    fundingValidation = createMockValidation('FundingValidation') as any;
    intentFundedValidation = createMockValidation('IntentFundedValidation') as any;
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
          provide: QUEUE_SERVICE,
          useValue: mockQueueService,
        },
        {
          provide: FundingValidation,
          useValue: fundingValidation,
        },
        {
          provide: IntentFundedValidation,
          useValue: intentFundedValidation,
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
    blockchainExecutorService = module.get(BlockchainExecutorService);
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
      expect(validations[0]).toBe(fundingValidation);
      expect(validations[1]).toBe(intentFundedValidation);
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
          reward: { nativeValue: BigInt(0), tokens: [{ amount: BigInt(1000), token: '0x123' as any }] } as any,
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
      expect(fundingValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);
      expect(intentFundedValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);
      expect(routeTokenValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);
      expect(routeCallsValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);
      expect(expirationValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);
      expect(chainSupportValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);
      expect(proverSupportValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);
      expect(executorBalanceValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);
      expect(standardFeeValidation.validate).toHaveBeenCalledWith(mockIntent, strategy);

      // Verify each validation was called exactly once
      [
        fundingValidation,
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

    it('should stop and throw on first validation failure', async () => {
      const mockIntent = createMockIntent();

      // Make the third validation (routeTokenValidation) fail
      routeTokenValidation.validate.mockResolvedValue(false);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failed: RouteTokenValidation',
      );

      // Verify validations were called in order until failure
      expect(fundingValidation.validate).toHaveBeenCalledTimes(1);
      expect(intentFundedValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeTokenValidation.validate).toHaveBeenCalledTimes(1);

      // Verify subsequent validations were not called
      expect(routeCallsValidation.validate).not.toHaveBeenCalled();
      expect(routeAmountLimitValidation.validate).not.toHaveBeenCalled();
      expect(expirationValidation.validate).not.toHaveBeenCalled();
      expect(chainSupportValidation.validate).not.toHaveBeenCalled();
      expect(proverSupportValidation.validate).not.toHaveBeenCalled();
      expect(executorBalanceValidation.validate).not.toHaveBeenCalled();
      expect(standardFeeValidation.validate).not.toHaveBeenCalled();
    });

    it('should propagate validation errors', async () => {
      const mockIntent = createMockIntent();
      const validationError = new Error('Custom validation error');

      fundingValidation.validate.mockRejectedValue(validationError);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(validationError);
    });

    it('should handle multiple validation failures correctly', async () => {
      const mockIntent = createMockIntent();

      // Make multiple validations return false
      routeTokenValidation.validate.mockResolvedValue(false);
      chainSupportValidation.validate.mockResolvedValue(false);

      // Should fail on the first one
      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failed: RouteTokenValidation',
      );

      // chainSupportValidation should not have been reached
      expect(chainSupportValidation.validate).not.toHaveBeenCalled();
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
          reward: { nativeValue: BigInt(0), tokens: [{ amount: BigInt(1000), token: '0x123' as any }] } as any,
        }),
        createMockIntent({ status: 'VALIDATED' as any }),
      ];

      for (const intent of intents) {
        await strategy.execute(intent);
      }

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledTimes(3);
      intents.forEach((intent, index) => {
        expect(queueService.addIntentToExecutionQueue).toHaveBeenNthCalledWith(
          index + 1,
          {
            strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
            intent,
            chainId: intent.route.destination,
          },
        );
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