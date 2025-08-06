import { Test } from '@nestjs/testing';

import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { CrowdLiquidityFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';
import {
  ChainSupportValidation,
  CrowdLiquidityFeeValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  IntentFundedValidation,
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteTokenValidation,
} from '@/modules/fulfillment/validations';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

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

describe('CrowdLiquidityFulfillmentStrategy', () => {
  let strategy: CrowdLiquidityFulfillmentStrategy;
  let blockchainReaderService: jest.Mocked<BlockchainReaderService>;
  let queueService: jest.Mocked<QueueService>;

  // Mock validation services
  let intentFundedValidation: jest.Mocked<IntentFundedValidation>;
  let routeTokenValidation: jest.Mocked<RouteTokenValidation>;
  let routeCallsValidation: jest.Mocked<RouteCallsValidation>;
  let routeAmountLimitValidation: jest.Mocked<RouteAmountLimitValidation>;
  let expirationValidation: jest.Mocked<ExpirationValidation>;
  let chainSupportValidation: jest.Mocked<ChainSupportValidation>;
  let proverSupportValidation: jest.Mocked<ProverSupportValidation>;
  let executorBalanceValidation: jest.Mocked<ExecutorBalanceValidation>;
  let crowdLiquidityFeeValidation: jest.Mocked<CrowdLiquidityFeeValidation>;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock services
    const mockBlockchainExecutorService = {};
    const mockBlockchainReaderService = {};
    const mockQueueService = {
      addIntentToExecutionQueue: jest.fn(),
    };

    // Create mock validations
    const createMockValidation = (name: string) => ({
      validate: jest.fn().mockResolvedValue(true),
      constructor: { name },
    });

    intentFundedValidation = createMockValidation('IntentFundedValidation') as any;
    routeTokenValidation = createMockValidation('RouteTokenValidation') as any;
    routeCallsValidation = createMockValidation('RouteCallsValidation') as any;
    routeAmountLimitValidation = createMockValidation('RouteAmountLimitValidation') as any;
    expirationValidation = createMockValidation('ExpirationValidation') as any;
    chainSupportValidation = createMockValidation('ChainSupportValidation') as any;
    proverSupportValidation = createMockValidation('ProverSupportValidation') as any;
    executorBalanceValidation = createMockValidation('ExecutorBalanceValidation') as any;
    crowdLiquidityFeeValidation = createMockValidation('CrowdLiquidityFeeValidation') as any;

    const module = await Test.createTestingModule({
      providers: [
        CrowdLiquidityFulfillmentStrategy,
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
          provide: CrowdLiquidityFeeValidation,
          useValue: crowdLiquidityFeeValidation,
        },
      ],
    }).compile();

    strategy = module.get<CrowdLiquidityFulfillmentStrategy>(CrowdLiquidityFulfillmentStrategy);
    blockchainReaderService = module.get(BlockchainReaderService);
    queueService = module.get(QUEUE_SERVICE);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(strategy.name).toBe(FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY);
    });

    it('should have the correct validations in order', () => {
      const validations = (strategy as any).getValidations();
      expect(validations).toHaveLength(9);
      expect(validations[0]).toBe(intentFundedValidation);
      expect(validations[1]).toBe(routeTokenValidation);
      expect(validations[2]).toBe(routeCallsValidation);
      expect(validations[3]).toBe(routeAmountLimitValidation);
      expect(validations[4]).toBe(expirationValidation);
      expect(validations[5]).toBe(chainSupportValidation);
      expect(validations[6]).toBe(proverSupportValidation);
      expect(validations[7]).toBe(executorBalanceValidation);
      expect(validations[8]).toBe(crowdLiquidityFeeValidation);
    });

    it('should use CrowdLiquidityFeeValidation instead of StandardFeeValidation', () => {
      const validations = (strategy as any).getValidations();
      expect(validations[8]).toBe(crowdLiquidityFeeValidation);
      expect(validations.some((v: any) => v.constructor.name === 'StandardFeeValidation')).toBe(
        false,
      );
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
    it('should always return false (only enabled via configuration)', () => {
      const mockIntent = createMockIntent();
      expect(strategy.canHandle(mockIntent)).toBe(false);
    });

    it('should return false for different intent configurations', () => {
      const intents = [
        createMockIntent({ route: { source: BigInt(1), destination: BigInt(10) } as any }),
        createMockIntent({ route: { source: BigInt(137), destination: BigInt(42161) } as any }),
        createMockIntent({
          reward: {
            nativeValue: BigInt(10000000000000000000), // Large amount
            tokens: [{ amount: BigInt(1000000), token: '0x123' as any }],
          } as any,
        }),
        createMockIntent({
          route: {
            tokens: [
              {
                amount: BigInt(1000000000),
                token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as any,
              }, // USDC
              {
                amount: BigInt(1000000000),
                token: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as any,
              }, // USDT
            ],
          } as any,
        }),
      ];

      intents.forEach((intent) => {
        expect(strategy.canHandle(intent)).toBe(false);
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
      expect(crowdLiquidityFeeValidation.validate).toHaveBeenCalledWith(
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
        crowdLiquidityFeeValidation,
      ].forEach((validation) => {
        expect(validation.validate).toHaveBeenCalledTimes(1);
      });
    });

    it('should stop and throw on first validation failure', async () => {
      const mockIntent = createMockIntent();

      // Make the crowd liquidity fee validation fail
      crowdLiquidityFeeValidation.validate.mockResolvedValue(false);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failed: CrowdLiquidityFeeValidation',
      );

      // Verify validations were called in order until failure
      expect(intentFundedValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeTokenValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeCallsValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledTimes(1);
      expect(expirationValidation.validate).toHaveBeenCalledTimes(1);
      expect(chainSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(proverSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(executorBalanceValidation.validate).toHaveBeenCalledTimes(1);
      expect(crowdLiquidityFeeValidation.validate).toHaveBeenCalledTimes(1);
    });

    it('should propagate validation errors', async () => {
      const mockIntent = createMockIntent();
      const validationError = new Error('Crowd liquidity pool unavailable');

      crowdLiquidityFeeValidation.validate.mockRejectedValue(validationError);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(validationError);
    });

    it('should handle early validation failures', async () => {
      const mockIntent = createMockIntent();

      // Make an early validation fail
      expirationValidation.validate.mockResolvedValue(false);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failed: ExpirationValidation',
      );

      // Verify later validations were not called
      expect(chainSupportValidation.validate).not.toHaveBeenCalled();
      expect(proverSupportValidation.validate).not.toHaveBeenCalled();
      expect(executorBalanceValidation.validate).not.toHaveBeenCalled();
      expect(crowdLiquidityFeeValidation.validate).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    it('should add intent to execution queue with correct parameters', async () => {
      const mockIntent = createMockIntent();

      await strategy.execute(mockIntent);

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledWith({
        strategy: FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY,
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

    it('should handle different intent configurations for crowd liquidity', async () => {
      const intents = [
        createMockIntent({
          route: {
            source: BigInt(1),
            destination: BigInt(10),
            tokens: [
              {
                amount: BigInt(1000000),
                token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as any,
              },
            ],
          } as any,
        }),
        createMockIntent({
          reward: {
            nativeValue: BigInt(0),
            tokens: [
              {
                amount: BigInt(5000000),
                token: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as any,
              },
            ],
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
          strategy: FULFILLMENT_STRATEGY_NAMES.CROWD_LIQUIDITY,
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
      expect(validations).toHaveLength(9);
      expect(Object.isFrozen(validations)).toBe(true);
    });

    it('should include crowd liquidity specific fee validation', () => {
      const validations = (strategy as any).getValidations();
      const lastValidation = validations[validations.length - 1];

      expect(lastValidation).toBe(crowdLiquidityFeeValidation);
    });
  });
});
