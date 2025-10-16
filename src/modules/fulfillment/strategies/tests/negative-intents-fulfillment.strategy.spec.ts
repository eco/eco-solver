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
    tracer: {
      startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
        const span = {
          setAttribute: jest.fn(),
          setAttributes: jest.fn(),
          addEvent: jest.fn(),
          setStatus: jest.fn(),
          recordException: jest.fn(),
          end: jest.fn(),
        };
        return fn(span);
      }),
    },
    withSpan: jest.fn().mockImplementation(async (name, fn) => {
      const span = {
        setAttribute: jest.fn(),
        setAttributes: jest.fn(),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      };
      return fn(span);
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
  NativeFeeValidation,
  ProverSupportValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteEnabledValidation,
  RouteTokenValidation,
} from '@/modules/fulfillment/validations';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { NegativeIntentsFulfillmentStrategy } from '../negative-intents-fulfillment.strategy';

describe('NegativeIntentsFulfillmentStrategy', () => {
  let strategy: NegativeIntentsFulfillmentStrategy;
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
  let routeEnabledValidation: jest.Mocked<RouteEnabledValidation>;
  let proverSupportValidation: jest.Mocked<ProverSupportValidation>;
  let executorBalanceValidation: jest.Mocked<ExecutorBalanceValidation>;
  let nativeFeeValidation: jest.Mocked<NativeFeeValidation>;

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
      tracer: {
        startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
          const span = {
            setAttribute: jest.fn(),
            setAttributes: jest.fn(),
            addEvent: jest.fn(),
            setStatus: jest.fn(),
            recordException: jest.fn(),
            end: jest.fn(),
          };
          return fn(span);
        }),
      },
      withSpan: jest.fn().mockImplementation(async (name, fn) => {
        const span = {
          setAttribute: jest.fn(),
          setAttributes: jest.fn(),
          addEvent: jest.fn(),
          setStatus: jest.fn(),
          recordException: jest.fn(),
          end: jest.fn(),
        };
        return fn(span);
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
    routeEnabledValidation = createMockValidation('RouteEnabledValidation') as any;
    proverSupportValidation = createMockValidation('ProverSupportValidation') as any;
    executorBalanceValidation = createMockValidation('ExecutorBalanceValidation') as any;
    nativeFeeValidation = createMockValidation('NativeFeeValidation') as any;

    const module = await Test.createTestingModule({
      providers: [
        NegativeIntentsFulfillmentStrategy,
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
          provide: RouteEnabledValidation,
          useValue: routeEnabledValidation,
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

    strategy = module.get<NegativeIntentsFulfillmentStrategy>(NegativeIntentsFulfillmentStrategy);
    _blockchainExecutorService = module.get(BlockchainExecutorService);
    _blockchainReaderService = module.get(BlockchainReaderService);
    queueService = module.get(QUEUE_SERVICE);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(strategy.name).toBe(FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS);
    });

    it('should have the correct validations in order', () => {
      const validations = (strategy as any).getValidations();
      expect(validations).toHaveLength(11);
      expect(validations[0]).toBe(intentFundedValidation);
      expect(validations[1]).toBe(duplicateRewardTokensValidation);
      expect(validations[2]).toBe(routeTokenValidation);
      expect(validations[3]).toBe(routeCallsValidation);
      expect(validations[4]).toBe(routeAmountLimitValidation);
      expect(validations[5]).toBe(expirationValidation);
      expect(validations[6]).toBe(chainSupportValidation);
      expect(validations[7]).toBe(routeEnabledValidation);
      expect(validations[8]).toBe(proverSupportValidation);
      expect(validations[9]).toBe(executorBalanceValidation);
      expect(validations[10]).toBe(nativeFeeValidation);
    });

    it('should use NativeFeeValidation for negative intents', () => {
      const validations = (strategy as any).getValidations();
      expect(validations[10]).toBe(nativeFeeValidation);
      expect(validations.some((v: any) => v.constructor.name === 'StandardFeeValidation')).toBe(
        false,
      );
      expect(
        validations.some((v: any) => v.constructor.name === 'CrowdLiquidityFeeValidation'),
      ).toBe(false);
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

    it('should return false for various intent configurations', () => {
      const intents = [
        // Normal intent
        createMockIntent(),
        // Intent with specific debt-like patterns (future implementation)
        createMockIntent({
          route: {
            calls: [
              {
                target: '0xAaveProtocolAddress' as any,
                data: '0xborrowFunction' as any,
                value: BigInt(0),
              },
            ],
          } as any,
        }),
        // Intent with negative value patterns
        createMockIntent({
          reward: {
            nativeAmount: BigInt(0),
            tokens: [
              {
                amount: BigInt(1000000),
                token: '0xDebtTokenAddress' as any,
              },
            ],
          } as any,
        }),
        // Cross-chain debt settlement
        createMockIntent({
          route: {
            source: BigInt(1),
            destination: BigInt(137),
            calls: [
              {
                target: '0xLendingProtocol' as any,
                data: '0xrepayDebt' as any,
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

    it('should return false even for potential negative intent patterns', () => {
      // Even with patterns that might indicate debt/negative intents,
      // the strategy currently only activates via configuration
      const debtIntent = createMockIntent({
        route: {
          calls: [
            {
              target: '0xCompoundFinance' as any,
              data: '0xborrow' as any,
              value: BigInt(0),
            },
            {
              target: '0xAaveProtocol' as any,
              data: '0xflashLoan' as any,
              value: BigInt(0),
            },
          ],
        } as any,
      });

      expect(strategy.canHandle(debtIntent)).toBe(false);
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
      expect(routeEnabledValidation.validate).toHaveBeenCalledWith(
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
      expect(nativeFeeValidation.validate).toHaveBeenCalledWith(
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
        routeEnabledValidation,
        proverSupportValidation,
        executorBalanceValidation,
        nativeFeeValidation,
      ].forEach((validation) => {
        expect(validation.validate).toHaveBeenCalledTimes(1);
      });
    });

    it('should throw aggregated error on validation failure', async () => {
      const mockIntent = createMockIntent();

      // Make a middle validation fail
      routeAmountLimitValidation.validate.mockResolvedValue(false);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Validation failed: RouteAmountLimitValidation',
      );

      // All validations should have been called (parallel execution)
      expect(intentFundedValidation.validate).toHaveBeenCalledTimes(1);
      expect(duplicateRewardTokensValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeTokenValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeCallsValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledTimes(1);
      expect(expirationValidation.validate).toHaveBeenCalledTimes(1);
      expect(chainSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeEnabledValidation.validate).toHaveBeenCalledTimes(1);
      expect(proverSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(executorBalanceValidation.validate).toHaveBeenCalledTimes(1);
      expect(nativeFeeValidation.validate).toHaveBeenCalledTimes(1);
    });

    it('should propagate validation errors', async () => {
      const mockIntent = createMockIntent();
      const validationError = new Error('Negative intent validation error');

      proverSupportValidation.validate.mockRejectedValue(validationError);

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'Negative intent validation error',
      );
    });

    it('should handle complex negative intent scenarios', async () => {
      const negativeIntent = createMockIntent({
        route: {
          calls: [
            {
              target: '0xDebtSettlementContract' as any,
              data: '0xsettleDebt' as any,
              value: BigInt(0),
            },
          ],
          tokens: [
            {
              amount: BigInt(-1000000), // Negative amount representing debt
              token: '0xDebtToken' as any,
            },
          ],
        } as any,
      });

      const result = await strategy.validate(negativeIntent);
      expect(result).toBe(true);

      // All validations should still be called for negative intents
      expect(nativeFeeValidation.validate).toHaveBeenCalledWith(
        negativeIntent,
        expect.objectContaining({ strategy }),
      );
    });
  });

  describe('execute', () => {
    it('should add intent to execution queue with correct parameters', async () => {
      const mockIntent = createMockIntent();

      await strategy.execute(mockIntent);

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledWith({
        strategy: FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS,
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

    it('should handle various negative intent configurations', async () => {
      const intents = [
        // Debt repayment intent
        createMockIntent({
          route: {
            calls: [
              {
                target: '0xLendingProtocol' as any,
                data: '0xrepayDebt' as any,
                value: BigInt(1000000000000000000),
              },
            ],
          } as any,
        }),
        // Flash loan intent
        createMockIntent({
          route: {
            calls: [
              {
                target: '0xFlashLoanProvider' as any,
                data: '0xexecuteFlashLoan' as any,
                value: BigInt(0),
              },
            ],
            tokens: [
              {
                amount: BigInt(10000000000),
                token: '0xUSDC' as any,
              },
            ],
          } as any,
        }),
        // Cross-chain debt settlement
        createMockIntent({
          route: {
            source: BigInt(1),
            destination: BigInt(42161),
            calls: [
              {
                target: '0xCrossChainDebtSettler' as any,
                data: '0xsettleDebt' as any,
                value: BigInt(0),
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
          strategy: FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS,
          intent,
          chainId: intent.destination,
          walletId: 'kernel',
        });
      });
    });

    it('should handle both EVM and SVM executor scenarios', async () => {
      // Test intent that might use EVM executor
      const evmIntent = createMockIntent({
        route: {
          source: BigInt(1), // Ethereum
          destination: BigInt(137), // Polygon
        } as any,
      });

      // Test intent that might use SVM executor
      const svmIntent = createMockIntent({
        route: {
          source: BigInt(1), // Ethereum
          destination: BigInt(999999999), // Solana (example chain ID)
        } as any,
      });

      await strategy.execute(evmIntent);
      await strategy.execute(svmIntent);

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledTimes(2);
      expect(queueService.addIntentToExecutionQueue).toHaveBeenNthCalledWith(1, {
        strategy: FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS,
        intent: evmIntent,
        chainId: evmIntent.destination,
        walletId: 'kernel',
      });
      expect(queueService.addIntentToExecutionQueue).toHaveBeenNthCalledWith(2, {
        strategy: FULFILLMENT_STRATEGY_NAMES.NEGATIVE_INTENTS,
        intent: svmIntent,
        chainId: svmIntent.destination,
        walletId: 'kernel',
      });
    });
  });

  describe('getValidations', () => {
    it('should return the correct validations array', () => {
      const validations = (strategy as any).getValidations();

      expect(Array.isArray(validations)).toBe(true);
      expect(validations).toHaveLength(11);
      expect(Object.isFrozen(validations)).toBe(true);
    });

    it('should include native fee validation for negative intents', () => {
      const validations = (strategy as any).getValidations();
      const lastValidation = validations[validations.length - 1];

      expect(lastValidation).toBe(nativeFeeValidation);
    });
  });
});
