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
  NativeFeeValidation,
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteTokenValidation,
} from '@/modules/fulfillment/validations';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { NativeIntentsFulfillmentStrategy } from '../native-intents-fulfillment.strategy';

describe('NativeIntentsFulfillmentStrategy', () => {
  let strategy: NativeIntentsFulfillmentStrategy;
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
  let nativeFeeValidation: jest.Mocked<NativeFeeValidation>;

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
    nativeFeeValidation = createMockValidation('NativeFeeValidation') as any;

    const module = await Test.createTestingModule({
      providers: [
        NativeIntentsFulfillmentStrategy,
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
          provide: NativeFeeValidation,
          useValue: nativeFeeValidation,
        },
      ],
    }).compile();

    strategy = module.get<NativeIntentsFulfillmentStrategy>(NativeIntentsFulfillmentStrategy);
    blockchainExecutorService = module.get(BlockchainExecutorService);
    queueService = module.get(QUEUE_SERVICE);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(strategy.name).toBe(FULFILLMENT_STRATEGY_NAMES.NATIVE_INTENTS);
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
      expect(validations[9]).toBe(nativeFeeValidation);
    });

    it('should use NativeFeeValidation instead of StandardFeeValidation', () => {
      const validations = (strategy as any).getValidations();
      expect(validations[9]).toBe(nativeFeeValidation);
      expect(validations.some((v: any) => v.constructor.name === 'StandardFeeValidation')).toBe(false);
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
    it('should return true for intents with only native value and no tokens', () => {
      const mockIntent = createMockIntent({
        reward: {
          prover: '0x1234567890123456789012345678901234567890' as any,
          creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as any,
          deadline: BigInt(Date.now() + 86400000),
          nativeValue: BigInt(1000000000000000000), // 1 ETH
          tokens: [], // No tokens
        },
        route: {
          source: BigInt(1),
          destination: BigInt(10),
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as any,
          inbox: '0x9876543210987654321098765432109876543210' as any,
          calls: [],
          tokens: [], // No tokens
        },
      });

      expect(strategy.canHandle(mockIntent)).toBe(true);
    });

    it('should return false for intents with token transfers in route', () => {
      const mockIntent = createMockIntent({
        route: {
          source: BigInt(1),
          destination: BigInt(10),
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as any,
          inbox: '0x9876543210987654321098765432109876543210' as any,
          calls: [],
          tokens: [{ amount: BigInt(1000), token: '0x123' as any }], // Has tokens
        },
      });

      expect(strategy.canHandle(mockIntent)).toBe(false);
    });

    it('should return false for intents with token rewards', () => {
      const mockIntent = createMockIntent({
        reward: {
          prover: '0x1234567890123456789012345678901234567890' as any,
          creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as any,
          deadline: BigInt(Date.now() + 86400000),
          nativeValue: BigInt(1000000000000000000),
          tokens: [{ amount: BigInt(500), token: '0xabc' as any }], // Has token rewards
        },
      });

      expect(strategy.canHandle(mockIntent)).toBe(false);
    });

    it('should return false for intents with no native value', () => {
      const mockIntent = createMockIntent({
        reward: {
          prover: '0x1234567890123456789012345678901234567890' as any,
          creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as any,
          deadline: BigInt(Date.now() + 86400000),
          nativeValue: BigInt(0), // No native value
          tokens: [],
        },
      });

      expect(strategy.canHandle(mockIntent)).toBe(false);
    });

    it('should return false for intents with both tokens and native value', () => {
      const mockIntent = createMockIntent({
        reward: {
          prover: '0x1234567890123456789012345678901234567890' as any,
          creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as any,
          deadline: BigInt(Date.now() + 86400000),
          nativeValue: BigInt(1000000000000000000),
          tokens: [{ amount: BigInt(1000), token: '0x123' as any }],
        },
        route: {
          source: BigInt(1),
          destination: BigInt(10),
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as any,
          inbox: '0x9876543210987654321098765432109876543210' as any,
          calls: [],
          tokens: [{ amount: BigInt(2000), token: '0x456' as any }],
        },
      });

      expect(strategy.canHandle(mockIntent)).toBe(false);
    });

    it('should handle different native value amounts correctly', () => {
      const nativeOnlyIntents = [
        createMockIntent({ reward: { nativeValue: BigInt(1) } as any }), // 1 wei
        createMockIntent({ reward: { nativeValue: BigInt(1000000000) } as any }), // 1 gwei
        createMockIntent({ reward: { nativeValue: BigInt('1000000000000000000000') } as any }), // 1000 ETH
      ];

      nativeOnlyIntents.forEach((intent) => {
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
      expect(fundingValidation.validate).toHaveBeenCalledWith(mockIntent);
      expect(intentFundedValidation.validate).toHaveBeenCalledWith(mockIntent);
      expect(routeTokenValidation.validate).toHaveBeenCalledWith(mockIntent);
      expect(routeCallsValidation.validate).toHaveBeenCalledWith(mockIntent);
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledWith(mockIntent);
      expect(expirationValidation.validate).toHaveBeenCalledWith(mockIntent);
      expect(chainSupportValidation.validate).toHaveBeenCalledWith(mockIntent);
      expect(proverSupportValidation.validate).toHaveBeenCalledWith(mockIntent);
      expect(executorBalanceValidation.validate).toHaveBeenCalledWith(mockIntent);
      expect(nativeFeeValidation.validate).toHaveBeenCalledWith(mockIntent);

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
        nativeFeeValidation,
      ].forEach((validation) => {
        expect(validation.validate).toHaveBeenCalledTimes(1);
      });
    });

    it('should stop and throw on first validation failure', async () => {
      const mockIntent = createMockIntent();

      // Make the native fee validation fail
      nativeFeeValidation.validate.mockResolvedValue(false);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failed: NativeFeeValidation',
      );

      // Verify validations were called in order until failure
      expect(fundingValidation.validate).toHaveBeenCalledTimes(1);
      expect(intentFundedValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeTokenValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeCallsValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledTimes(1);
      expect(expirationValidation.validate).toHaveBeenCalledTimes(1);
      expect(chainSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(proverSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(executorBalanceValidation.validate).toHaveBeenCalledTimes(1);
      expect(nativeFeeValidation.validate).toHaveBeenCalledTimes(1);
    });

    it('should propagate validation errors', async () => {
      const mockIntent = createMockIntent();
      const validationError = new Error('Native fee calculation error');

      nativeFeeValidation.validate.mockRejectedValue(validationError);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(validationError);
    });

    it('should handle early validation failures', async () => {
      const mockIntent = createMockIntent();

      // Make an early validation fail
      fundingValidation.validate.mockResolvedValue(false);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failed: FundingValidation',
      );

      // Verify only first validation was called
      expect(fundingValidation.validate).toHaveBeenCalledTimes(1);
      expect(intentFundedValidation.validate).not.toHaveBeenCalled();
      expect(nativeFeeValidation.validate).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    it('should add intent to execution queue with correct parameters', async () => {
      const mockIntent = createMockIntent();

      await strategy.execute(mockIntent);

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledWith(
        mockIntent,
        FULFILLMENT_STRATEGY_NAMES.NATIVE_INTENTS,
      );
      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledTimes(1);
    });

    it('should propagate queue service errors', async () => {
      const mockIntent = createMockIntent();
      const queueError = new Error('Queue service error');

      queueService.addIntentToExecutionQueue.mockRejectedValue(queueError);

      await expect(strategy.execute(mockIntent)).rejects.toThrow(queueError);
    });

    it('should handle native-only intent configurations', async () => {
      const intents = [
        createMockIntent({ 
          reward: { nativeValue: BigInt(1000000000000000000) } as any,
          route: { tokens: [] } as any,
        }),
        createMockIntent({
          reward: { 
            nativeValue: BigInt(500000000000000000), // 0.5 ETH
            tokens: [],
          } as any,
        }),
        createMockIntent({ 
          status: 'VALIDATED' as any,
          reward: { nativeValue: BigInt(2000000000000000000) } as any,
        }),
      ];

      for (const intent of intents) {
        await strategy.execute(intent);
      }

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledTimes(3);
      intents.forEach((intent, index) => {
        expect(queueService.addIntentToExecutionQueue).toHaveBeenNthCalledWith(
          index + 1,
          intent,
          FULFILLMENT_STRATEGY_NAMES.NATIVE_INTENTS,
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

    it('should include native fee validation', () => {
      const validations = (strategy as any).getValidations();
      const lastValidation = validations[validations.length - 1];
      
      expect(lastValidation).toBe(nativeFeeValidation);
    });
  });
});