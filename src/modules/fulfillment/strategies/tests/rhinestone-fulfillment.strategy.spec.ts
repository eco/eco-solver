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
    withSpan: jest.fn().mockImplementation((name, fn) => {
      const mockSpan = {
        setAttribute: jest.fn(),
        setAttributes: jest.fn(),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      };
      return fn(mockSpan);
    }),
  })),
}));

import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';
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
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { RhinestoneFulfillmentStrategy } from '../rhinestone-fulfillment.strategy';

describe('RhinestoneFulfillmentStrategy', () => {
  let strategy: RhinestoneFulfillmentStrategy;
  let _blockchainExecutorService: jest.Mocked<BlockchainExecutorService>;
  let _blockchainReaderService: jest.Mocked<BlockchainReaderService>;
  let queueService: jest.Mocked<IQueueService>;
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
      withSpan: jest.fn().mockImplementation((name, fn) => {
        const mockSpan = {
          setAttribute: jest.fn(),
          setAttributes: jest.fn(),
          addEvent: jest.fn(),
          setStatus: jest.fn(),
          recordException: jest.fn(),
          end: jest.fn(),
        };
        return fn(mockSpan);
      }),
    };

    // Create mock validations
    const createMockValidation = (name: string) => ({
      validate: jest.fn().mockResolvedValue(true),
      constructor: { name },
    });

    intentFundedValidation = createMockValidation('IntentFundedValidation') as any;
    duplicateRewardTokensValidation = createMockValidation(
      'DuplicateRewardTokensValidation',
    ) as any;
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
        RhinestoneFulfillmentStrategy,
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

    strategy = module.get<RhinestoneFulfillmentStrategy>(RhinestoneFulfillmentStrategy);
    _blockchainExecutorService = module.get(BlockchainExecutorService);
    _blockchainReaderService = module.get(BlockchainReaderService);
    queueService = module.get(QUEUE_SERVICE);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(strategy.name).toBe(FULFILLMENT_STRATEGY_NAMES.RHINESTONE);
    });

    it('should have the correct validations in order WITHOUT RouteCallsValidation', () => {
      const validations = (strategy as any).getValidations();
      expect(validations).toHaveLength(9); // One less than standard strategy
      expect(validations[0]).toBe(intentFundedValidation);
      expect(validations[1]).toBe(duplicateRewardTokensValidation);
      expect(validations[2]).toBe(routeTokenValidation);
      // RouteCallsValidation is intentionally skipped
      expect(validations[3]).toBe(routeAmountLimitValidation);
      expect(validations[4]).toBe(expirationValidation);
      expect(validations[5]).toBe(chainSupportValidation);
      expect(validations[6]).toBe(proverSupportValidation);
      expect(validations[7]).toBe(executorBalanceValidation);
      expect(validations[8]).toBe(standardFeeValidation);
    });

    it('should exclude RouteCallsValidation from validations', () => {
      const validations = (strategy as any).getValidations();
      expect(validations).not.toContain(routeCallsValidation);
      expect(validations.some((v: any) => v.constructor.name === 'RouteCallsValidation')).toBe(
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

    it('should return false for various smart account scenarios', () => {
      const intents = [
        // Normal intent
        createMockIntent(),
        // Intent with smart account as target
        createMockIntent({
          route: {
            calls: [
              {
                target: '0x4337000000000000000000000000000000000000' as any, // Safe address
                data: '0xexecTransaction' as any,
                value: BigInt(0),
              },
            ],
          } as any,
        }),
        // Intent with account abstraction patterns
        createMockIntent({
          route: {
            calls: [
              {
                target: '0xSmartAccountFactory' as any,
                data: '0xcreateAccount' as any,
                value: BigInt(0),
              },
            ],
          } as any,
        }),
        // Intent with bundled operations
        createMockIntent({
          route: {
            calls: [
              {
                target: '0xEntryPoint' as any,
                data: '0xhandleOps' as any,
                value: BigInt(0),
              },
              {
                target: '0xPaymaster' as any,
                data: '0xvalidatePaymasterUserOp' as any,
                value: BigInt(0),
              },
            ],
          } as any,
        }),
      ];

      intents.forEach((intent) => {
        expect(strategy.canHandle(intent)).toBe(false);
      });
    });

    it('should return false even for EIP-4337 UserOperation patterns', () => {
      // Even with patterns that indicate account abstraction,
      // the strategy currently only activates via configuration
      const userOpIntent = createMockIntent({
        route: {
          calls: [
            {
              target: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as any, // EntryPoint v0.6
              data: '0x1fad948c' as any, // handleOps selector
              value: BigInt(0),
            },
          ],
          inbox: '0x4337000000000000000000000000000000000001' as any, // ERC-4337 sender
        } as any,
      });

      expect(strategy.canHandle(userOpIntent)).toBe(false);
    });
  });

  describe('validate', () => {
    it('should run all validations in order excluding RouteCallsValidation', async () => {
      const mockIntent = createMockIntent();
      const result = await strategy.validate(mockIntent);

      expect(result).toBe(true);

      // Verify validations were called (excluding RouteCallsValidation)
      expect(intentFundedValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(routeTokenValidation.validate).toHaveBeenCalledWith(
        mockIntent,
        expect.objectContaining({ strategy }),
      );
      expect(routeCallsValidation.validate).toHaveBeenCalledTimes(0); // Should NOT be called
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

      // Verify each validation was called exactly once (except RouteCallsValidation)
      [
        intentFundedValidation,
        routeTokenValidation,
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

    it('should allow intents with complex call data that would fail RouteCallsValidation', async () => {
      const complexIntent = createMockIntent({
        route: {
          calls: [
            {
              target: '0x0000000000000000000000000000000000000000' as any, // Zero address
              data: '0x' as any, // Empty data
              value: BigInt(0),
            },
            {
              target: '0xInvalidAddress' as any, // Invalid format
              data: '0xmalformed' as any,
              value: BigInt(-1), // Negative value
            },
          ],
        } as any,
      });

      // Should still pass because RouteCallsValidation is skipped
      const result = await strategy.validate(complexIntent);
      expect(result).toBe(true);
      expect(routeCallsValidation.validate).toHaveBeenCalledTimes(0);
    });

    it('should throw aggregated error on validation failure', async () => {
      const mockIntent = createMockIntent();

      // Make the expiration validation fail
      expirationValidation.validate.mockResolvedValue(false);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failed: ExpirationValidation',
      );

      // Verify validations were called in order until failure
      expect(intentFundedValidation.validate).toHaveBeenCalledTimes(1);
      expect(duplicateRewardTokensValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeTokenValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeCallsValidation.validate).toHaveBeenCalledTimes(0); // Skipped
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledTimes(1);
      expect(expirationValidation.validate).toHaveBeenCalledTimes(1);

      // Verify subsequent validations were still called (because validation runs all in parallel)
      expect(chainSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(proverSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(executorBalanceValidation.validate).toHaveBeenCalledTimes(1);
      expect(standardFeeValidation.validate).toHaveBeenCalledTimes(1);
    });

    it('should propagate validation errors', async () => {
      const mockIntent = createMockIntent();
      const validationError = new Error('Smart account validation error');

      chainSupportValidation.validate.mockRejectedValue(validationError);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(validationError.message);
    });

    it('should handle smart account specific scenarios', async () => {
      const smartAccountIntent = createMockIntent({
        route: {
          calls: [
            {
              target: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as any, // Safe Proxy Factory
              data: '0x1688f0b9' as any, // createProxyWithNonce
              value: BigInt(0),
            },
            {
              target: '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762' as any, // Module
              data: '0xd4d9bdcd' as any, // execTransactionFromModule
              value: BigInt(1000000000000000000),
            },
          ],
        } as any,
      });

      const result = await strategy.validate(smartAccountIntent);
      expect(result).toBe(true);

      // RouteCallsValidation should not be invoked even for complex smart account operations
      expect(routeCallsValidation.validate).toHaveBeenCalledTimes(0);
    });
  });

  describe('execute', () => {
    it('should add intent to execution queue with correct parameters', async () => {
      const mockIntent = createMockIntent();

      await strategy.execute(mockIntent);

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledWith({
        strategy: FULFILLMENT_STRATEGY_NAMES.RHINESTONE,
        intent: mockIntent,
        chainId: mockIntent.destination,
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

    it('should handle various smart account intent configurations', async () => {
      const intents = [
        // Safe transaction
        createMockIntent({
          route: {
            calls: [
              {
                target: '0xSafeProxy' as any,
                data: '0xexecTransaction' as any,
                value: BigInt(0),
              },
            ],
          } as any,
        }),
        // EIP-4337 UserOperation
        createMockIntent({
          route: {
            calls: [
              {
                target: '0xEntryPoint' as any,
                data: '0xhandleOps' as any,
                value: BigInt(0),
              },
            ],
          } as any,
        }),
        // Modular smart account
        createMockIntent({
          route: {
            calls: [
              {
                target: '0xSmartAccount' as any,
                data: '0xexecuteWithModule' as any,
                value: BigInt(1000000000000000000),
              },
            ],
          } as any,
        }),
      ];

      for (const intent of intents) {
        await strategy.execute(intent);
      }

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledTimes(3);
      intents.forEach((intent, index) => {
        expect(queueService.addIntentToExecutionQueue).toHaveBeenNthCalledWith(index + 1, {
          strategy: FULFILLMENT_STRATEGY_NAMES.RHINESTONE,
          intent,
          chainId: intent.destination,
          walletId: 'kernel',
        });
      });
    });

    it('should use EVM executor for all smart account operations', async () => {
      // Rhinestone only supports EVM chains for smart accounts
      const evmChainIntents = [
        createMockIntent({ sourceChainId: BigInt(1), destination: BigInt(1) }), // Ethereum
        createMockIntent({ sourceChainId: BigInt(137), destination: BigInt(137) }), // Polygon
        createMockIntent({ sourceChainId: BigInt(10), destination: BigInt(42161) }), // Optimism to Arbitrum
      ];

      for (const intent of evmChainIntents) {
        await strategy.execute(intent);
      }

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledTimes(3);
      // All should be queued for Rhinestone strategy which uses EVM executor
      evmChainIntents.forEach((intent) => {
        expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledWith({
          strategy: FULFILLMENT_STRATEGY_NAMES.RHINESTONE,
          intent,
          chainId: intent.destination,
          walletId: 'kernel',
        });
      });
    });
  });

  describe('getValidations', () => {
    it('should return the correct validations array without RouteCallsValidation', () => {
      const validations = (strategy as any).getValidations();

      expect(Array.isArray(validations)).toBe(true);
      expect(validations).toHaveLength(9); // One less than standard
      expect(Object.isFrozen(validations)).toBe(true);
    });

    it('should exclude RouteCallsValidation from the array', () => {
      const validations = (strategy as any).getValidations();

      expect(validations).not.toContain(routeCallsValidation);
      expect(validations.find((v: any) => v === routeCallsValidation)).toBeUndefined();
    });

    it('should maintain correct validation order', () => {
      const validations = (strategy as any).getValidations();

      // Check that validations are in the expected order
      expect(validations[0]).toBe(intentFundedValidation);
      expect(validations[1]).toBe(duplicateRewardTokensValidation);
      expect(validations[2]).toBe(routeTokenValidation);
      // RouteCallsValidation is intentionally skipped
      expect(validations[3]).toBe(routeAmountLimitValidation);
      expect(validations[4]).toBe(expirationValidation);
      expect(validations[5]).toBe(chainSupportValidation);
      expect(validations[6]).toBe(proverSupportValidation);
      expect(validations[7]).toBe(executorBalanceValidation);
      expect(validations[8]).toBe(standardFeeValidation);
    });
  });
});
