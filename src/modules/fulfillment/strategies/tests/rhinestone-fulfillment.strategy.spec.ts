import { Test } from '@nestjs/testing';
import { Address, Hex } from 'viem';

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
import { RhinestoneActionFulfillmentJob } from '@/modules/fulfillment/interfaces/fulfillment-job.interface';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';
import {
  ChainSupportValidation,
  DuplicateRewardTokensValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  ProverSupportValidation,
  RhinestoneValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteEnabledValidation,
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
  let duplicateRewardTokensValidation: jest.Mocked<any>;
  let routeTokenValidation: jest.Mocked<RouteTokenValidation>;
  let routeCallsValidation: jest.Mocked<RouteCallsValidation>;
  let routeAmountLimitValidation: jest.Mocked<RouteAmountLimitValidation>;
  let expirationValidation: jest.Mocked<ExpirationValidation>;
  let chainSupportValidation: jest.Mocked<ChainSupportValidation>;
  let routeEnabledValidation: jest.Mocked<RouteEnabledValidation>;
  let proverSupportValidation: jest.Mocked<ProverSupportValidation>;
  let executorBalanceValidation: jest.Mocked<ExecutorBalanceValidation>;
  let standardFeeValidation: jest.Mocked<StandardFeeValidation>;
  let rhinestoneValidation: jest.Mocked<RhinestoneValidation>;

  // Helper to create mock action job data
  function createMockActionJobData(
    overrides?: Partial<RhinestoneActionFulfillmentJob>,
  ): RhinestoneActionFulfillmentJob {
    const mockIntent = createMockIntent();
    return {
      type: 'rhinestone-action' as const,
      strategy: 'rhinestone' as const,
      messageId: 'test-message-id',
      actionId: 'test-action-id',
      claims: [
        {
          intent: mockIntent,
          intentHash: mockIntent.intentHash,
          chainId: BigInt(10),
          transaction: {
            to: '0x1234567890123456789012345678901234567890' as Address,
            data: '0xabcdef' as Hex,
            value: BigInt(0),
          },
        },
      ],
      fill: {
        intents: [mockIntent],
        chainId: BigInt(10),
        transaction: {
          to: '0x1234567890123456789012345678901234567890' as Address,
          data: '0xfedcba' as Hex,
          value: BigInt(0),
        },
        requiredApprovals: [],
      },
      walletId: 'kernel',
      ...overrides,
    };
  }

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock services
    const mockBlockchainExecutorService = {};
    const mockBlockchainReaderService = {};
    const mockQueueService = {
      addIntentToExecutionQueue: jest.fn(),
      addRhinestoneMulticlaimFlow: jest.fn(),
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
    standardFeeValidation = createMockValidation('StandardFeeValidation') as any;
    rhinestoneValidation = createMockValidation('RhinestoneValidation') as any;

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
          provide: StandardFeeValidation,
          useValue: standardFeeValidation,
        },
        {
          provide: RhinestoneValidation,
          useValue: rhinestoneValidation,
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
      expect(validations).toHaveLength(9); // Excludes IntentFundedValidation and RouteCallsValidation
      // NOTE: IntentFundedValidation excluded (Rhinestone solver funds via CLAIM)
      // NOTE: RouteCallsValidation excluded (smart accounts have custom patterns)
      expect(validations[0]).toBe(duplicateRewardTokensValidation);
      expect(validations[1]).toBe(routeTokenValidation);
      expect(validations[2]).toBe(routeAmountLimitValidation);
      expect(validations[3]).toBe(expirationValidation);
      expect(validations[4]).toBe(chainSupportValidation);
      expect(validations[5]).toBe(routeEnabledValidation);
      expect(validations[6]).toBe(proverSupportValidation);
      expect(validations[7]).toBe(executorBalanceValidation);
      expect(validations[8]).toBe(rhinestoneValidation);
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
    it('should always return true (Rhinestone intents explicitly queued)', () => {
      const mockIntent = createMockIntent();
      expect(strategy.canHandle(mockIntent)).toBe(true);
    });

    it('should return true for various smart account scenarios', () => {
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
        expect(strategy.canHandle(intent)).toBe(true);
      });
    });

    it('should return true even for EIP-4337 UserOperation patterns', () => {
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
          portal: '0x4337000000000000000000000000000000000001' as any, // ERC-4337 sender
        } as any,
      });

      expect(strategy.canHandle(userOpIntent)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should throw error - not supported for Rhinestone (use validateAction instead)', async () => {
      const mockIntent = createMockIntent();

      await expect(strategy.validate(mockIntent)).rejects.toThrow(
        'RhinestoneFulfillmentStrategy.validate() not supported',
      );
    });
  });

  describe('execute', () => {
    it('should throw error - not supported for Rhinestone (use executeAction instead)', async () => {
      const mockIntent = createMockIntent();

      await expect(strategy.execute(mockIntent)).rejects.toThrow(
        'RhinestoneFulfillmentStrategy.execute() not supported',
      );
    });
  });

  describe('validateAction', () => {
    it('should validate all intents in the action', async () => {
      const jobData = createMockActionJobData();

      await strategy.validateAction(jobData);

      // Each validation should be called once per intent (1 intent * 9 validations = 9 calls total)
      expect(duplicateRewardTokensValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeTokenValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledTimes(1);
      expect(expirationValidation.validate).toHaveBeenCalledTimes(1);
      expect(chainSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(routeEnabledValidation.validate).toHaveBeenCalledTimes(1);
      expect(proverSupportValidation.validate).toHaveBeenCalledTimes(1);
      expect(executorBalanceValidation.validate).toHaveBeenCalledTimes(1);
      expect(rhinestoneValidation.validate).toHaveBeenCalledTimes(1);
    });

    it('should validate multiple intents in the action', async () => {
      const intent1 = createMockIntent();
      const intent2 = createMockIntent({
        intentHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef0001' as Hex,
      });
      const intent3 = createMockIntent({
        intentHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef0002' as Hex,
      });

      const jobData = createMockActionJobData({
        claims: [
          {
            intent: intent1,
            intentHash: intent1.intentHash,
            chainId: BigInt(10),
            transaction: {
              to: '0x1234567890123456789012345678901234567890' as Address,
              data: '0xabcdef' as Hex,
              value: BigInt(0),
            },
          },
          {
            intent: intent2,
            intentHash: intent2.intentHash,
            chainId: BigInt(42161),
            transaction: {
              to: '0x1234567890123456789012345678901234567890' as Address,
              data: '0xabcdef' as Hex,
              value: BigInt(0),
            },
          },
          {
            intent: intent3,
            intentHash: intent3.intentHash,
            chainId: BigInt(137),
            transaction: {
              to: '0x1234567890123456789012345678901234567890' as Address,
              data: '0xabcdef' as Hex,
              value: BigInt(0),
            },
          },
        ],
        fill: {
          intents: [intent1, intent2, intent3],
          chainId: BigInt(10),
          transaction: {
            to: '0x1234567890123456789012345678901234567890' as Address,
            data: '0xfedcba' as Hex,
            value: BigInt(0),
          },
          requiredApprovals: [],
        },
      });

      await strategy.validateAction(jobData);

      // Each validation should be called 3 times (once per intent)
      expect(duplicateRewardTokensValidation.validate).toHaveBeenCalledTimes(3);
      expect(routeTokenValidation.validate).toHaveBeenCalledTimes(3);
      expect(routeAmountLimitValidation.validate).toHaveBeenCalledTimes(3);
      expect(expirationValidation.validate).toHaveBeenCalledTimes(3);
      expect(chainSupportValidation.validate).toHaveBeenCalledTimes(3);
      expect(routeEnabledValidation.validate).toHaveBeenCalledTimes(3);
      expect(proverSupportValidation.validate).toHaveBeenCalledTimes(3);
      expect(executorBalanceValidation.validate).toHaveBeenCalledTimes(3);
      expect(rhinestoneValidation.validate).toHaveBeenCalledTimes(3);
    });

    it('should throw ValidationError for unsupported settlement layer', async () => {
      const jobData = createMockActionJobData({
        claims: [
          {
            intent: createMockIntent(),
            intentHash: '0x1234' as Hex,
            chainId: BigInt(10),
            transaction: {
              to: '0x1234567890123456789012345678901234567890' as Address,
              data: '0xabcdef' as Hex,
              value: BigInt(0),
            },
            metadata: {
              settlementLayer: 'UNKNOWN',
            },
          },
        ],
      });

      await expect(strategy.validateAction(jobData)).rejects.toThrow(
        'Unsupported settlement layer: UNKNOWN',
      );
    });

    it('should pass validation for ECO settlement layer', async () => {
      const jobData = createMockActionJobData({
        claims: [
          {
            intent: createMockIntent(),
            intentHash: '0x1234' as Hex,
            chainId: BigInt(10),
            transaction: {
              to: '0x1234567890123456789012345678901234567890' as Address,
              data: '0xabcdef' as Hex,
              value: BigInt(0),
            },
            metadata: {
              settlementLayer: 'ECO',
            },
          },
        ],
      });

      await expect(strategy.validateAction(jobData)).resolves.not.toThrow();
    });

    it('should throw AggregatedValidationError when validation fails', async () => {
      const jobData = createMockActionJobData();
      const validationError = new Error('Expiration validation failed');
      expirationValidation.validate.mockRejectedValue(validationError);

      await expect(strategy.validateAction(jobData)).rejects.toThrow('Expiration validation');
    });

    it('should collect multiple validation failures', async () => {
      const intent1 = createMockIntent();
      const intent2 = createMockIntent({
        intentHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef0001' as Hex,
      });

      const jobData = createMockActionJobData({
        claims: [
          {
            intent: intent1,
            intentHash: intent1.intentHash,
            chainId: BigInt(10),
            transaction: {
              to: '0x1234567890123456789012345678901234567890' as Address,
              data: '0xabcdef' as Hex,
              value: BigInt(0),
            },
          },
          {
            intent: intent2,
            intentHash: intent2.intentHash,
            chainId: BigInt(42161),
            transaction: {
              to: '0x1234567890123456789012345678901234567890' as Address,
              data: '0xabcdef' as Hex,
              value: BigInt(0),
            },
          },
        ],
        fill: {
          intents: [intent1, intent2],
          chainId: BigInt(10),
          transaction: {
            to: '0x1234567890123456789012345678901234567890' as Address,
            data: '0xfedcba' as Hex,
            value: BigInt(0),
          },
          requiredApprovals: [],
        },
      });

      // Make multiple validations fail
      expirationValidation.validate.mockRejectedValue(new Error('Expired'));
      chainSupportValidation.validate.mockRejectedValue(new Error('Chain not supported'));

      await expect(strategy.validateAction(jobData)).rejects.toThrow();
    });

    it('should not include RouteCallsValidation', async () => {
      const jobData = createMockActionJobData();

      await strategy.validateAction(jobData);

      // RouteCallsValidation should NOT be called
      expect(routeCallsValidation.validate).not.toHaveBeenCalled();
    });
  });

  describe('executeAction', () => {
    it('should queue action to FlowProducer', async () => {
      const mockIntent = createMockIntent();
      const jobData = createMockActionJobData();

      await strategy.executeAction(jobData);

      expect(queueService.addRhinestoneMulticlaimFlow).toHaveBeenCalledWith({
        messageId: 'test-message-id',
        actionId: 'test-action-id',
        claims: [
          {
            intentHash: mockIntent.intentHash,
            chainId: BigInt(10),
            transaction: {
              to: '0x1234567890123456789012345678901234567890' as Address,
              data: '0xabcdef' as Hex,
              value: BigInt(0),
            },
          },
        ],
        fill: jobData.fill,
        walletId: 'kernel',
      });
    });

    it('should queue multiple claims in a single flow', async () => {
      const intent1 = createMockIntent();
      const intent2 = createMockIntent({
        intentHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef0001' as Hex,
      });

      const jobData = createMockActionJobData({
        claims: [
          {
            intent: intent1,
            intentHash: intent1.intentHash,
            chainId: BigInt(10),
            transaction: {
              to: '0x1111111111111111111111111111111111111111' as Address,
              data: '0x1111' as Hex,
              value: BigInt(100),
            },
          },
          {
            intent: intent2,
            intentHash: intent2.intentHash,
            chainId: BigInt(42161),
            transaction: {
              to: '0x2222222222222222222222222222222222222222' as Address,
              data: '0x2222' as Hex,
              value: BigInt(200),
            },
          },
        ],
        fill: {
          intents: [intent1, intent2],
          chainId: BigInt(10),
          transaction: {
            to: '0x3333333333333333333333333333333333333333' as Address,
            data: '0x3333' as Hex,
            value: BigInt(0),
          },
          requiredApprovals: [
            {
              token: '0x4444444444444444444444444444444444444444' as Address,
              amount: BigInt(1000000),
            },
          ],
        },
      });

      await strategy.executeAction(jobData);

      expect(queueService.addRhinestoneMulticlaimFlow).toHaveBeenCalledWith({
        messageId: 'test-message-id',
        actionId: 'test-action-id',
        claims: [
          {
            intentHash: intent1.intentHash,
            chainId: BigInt(10),
            transaction: {
              to: '0x1111111111111111111111111111111111111111' as Address,
              data: '0x1111' as Hex,
              value: BigInt(100),
            },
          },
          {
            intentHash: intent2.intentHash,
            chainId: BigInt(42161),
            transaction: {
              to: '0x2222222222222222222222222222222222222222' as Address,
              data: '0x2222' as Hex,
              value: BigInt(200),
            },
          },
        ],
        fill: jobData.fill,
        walletId: 'kernel',
      });
    });

    it('should propagate queue service errors', async () => {
      const jobData = createMockActionJobData();
      const queueError = new Error('Queue service error');

      queueService.addRhinestoneMulticlaimFlow.mockRejectedValue(queueError);

      await expect(strategy.executeAction(jobData)).rejects.toThrow(queueError);
    });
  });

  describe('getValidations', () => {
    it('should return the correct validations array without RouteCallsValidation', () => {
      const validations = (strategy as any).getValidations();

      expect(Array.isArray(validations)).toBe(true);
      expect(validations).toHaveLength(9); // Excludes IntentFundedValidation and RouteCallsValidation
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
      // NOTE: IntentFundedValidation is excluded (Rhinestone solver funds via CLAIM phase)
      // NOTE: RouteCallsValidation is excluded (smart accounts have custom patterns)
      expect(validations[0]).toBe(duplicateRewardTokensValidation);
      expect(validations[1]).toBe(routeTokenValidation);
      expect(validations[2]).toBe(routeAmountLimitValidation);
      expect(validations[3]).toBe(expirationValidation);
      expect(validations[4]).toBe(chainSupportValidation);
      expect(validations[5]).toBe(routeEnabledValidation);
      expect(validations[6]).toBe(proverSupportValidation);
      expect(validations[7]).toBe(executorBalanceValidation);
      expect(validations[8]).toBe(rhinestoneValidation);
    });
  });
});
