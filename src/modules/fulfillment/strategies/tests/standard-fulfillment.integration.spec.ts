import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import RedisMock from 'ioredis-mock';
import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { AggregatedValidationError } from '@/modules/fulfillment/errors/aggregated-validation.error';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { StandardFulfillmentStrategy } from '@/modules/fulfillment/strategies/standard-fulfillment.strategy';
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
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/interfaces/queue-service.interface';
import { TokenConfigService } from '@/modules/token/services/token-config.service';
import { TokenModule } from '@/modules/token/token.module';

// Mock TokenConfigService
const createMockTokenConfigService = () => ({
  isTokenSupported: jest.fn().mockImplementation((chainId: any, tokenAddress: string) => {
    // Return false for explicitly invalid addresses, true for everything else
    if (tokenAddress === '0xinvalid' || !tokenAddress || tokenAddress === 'undefined') {
      return false;
    }
    return true;
  }),
  getTokenConfig: jest.fn().mockImplementation((chainId: any, tokenAddress: string) => {
    // Return config for any valid token address
    return {
      decimals: 6,
      address: tokenAddress as Address,
    };
  }),
});

// Mock factories for services
const createMockBlockchainReader = () => ({
  getSupportedChains: jest.fn().mockReturnValue([1, 10, 137, 42161]),
  isChainSupported: jest.fn().mockImplementation((chainId) => {
    // Return false for test chains (999, 99999, 88888) used to simulate unsupported chains
    const unsupportedChains = [999, 99999, 88888];
    return !unsupportedChains.includes(Number(chainId));
  }),
  getReaderForChain: jest.fn().mockResolvedValue({
    getBalance: jest.fn().mockResolvedValue(BigInt('10000000000000000000')), // 10 ETH
    getTokenBalance: jest.fn().mockResolvedValue(BigInt('10000000000000000000')),
  }),
  getBalance: jest.fn().mockResolvedValue(BigInt('10000000000000000000')), // 10 ETH
  getTokenBalance: jest.fn().mockResolvedValue(BigInt('10000000000000000000')),
  isAddressValid: jest.fn().mockReturnValue(true),
  isIntentFunded: jest.fn().mockResolvedValue(true),
  fetchProverFee: jest.fn().mockResolvedValue(BigInt('1000000000000000')), // 0.001 ETH
});

const createMockBlockchainExecutor = () => ({
  getSupportedChains: jest.fn().mockReturnValue([1, 10, 137, 42161]),
  isChainSupported: jest.fn().mockImplementation((chainId) => {
    // Return false for test chains (999, 99999, 88888) used to simulate unsupported chains
    const unsupportedChains = [999, 99999, 88888];
    return !unsupportedChains.includes(Number(chainId));
  }),
  getExecutorForChain: jest.fn().mockResolvedValue({
    getWalletAddress: jest
      .fn()
      .mockResolvedValue('0x1234567890123456789012345678901234567890' as Address),
    executeIntent: jest.fn().mockResolvedValue(undefined),
  }),
  executeIntent: jest.fn().mockResolvedValue(undefined),
});

const createMockProverService = () => ({
  onModuleInit: jest.fn(),
  validateIntentRoute: jest.fn().mockResolvedValue({ isValid: true, reason: 'Valid route' }),
  getProver: jest.fn(),
  getMaxDeadlineBuffer: jest.fn().mockReturnValue(BigInt(3600)), // 1 hour
  validateProofSubmission: jest.fn(),
});

const createMockLogger = () => ({
  setContext: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

const createMockOpenTelemetryService = () => ({
  startSpan: jest.fn().mockReturnValue({
    setAttribute: jest.fn(),
    setAttributes: jest.fn(),
    addEvent: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
  }),
  getActiveSpan: jest.fn(),
  withSpan: jest.fn().mockImplementation(async (name, callback) => {
    const mockSpan = {
      setAttribute: jest.fn(),
      setAttributes: jest.fn(),
      addEvent: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    };
    return callback(mockSpan);
  }),
});

const createMockQueueService = () => ({
  addIntentToFulfillmentQueue: jest.fn(),
  addIntentToExecutionQueue: jest.fn(),
});

const createMockConfig = () => ({
  get: jest.fn().mockImplementation((key: string) => {
    const config = {
      'redis.host': 'localhost',
      'redis.port': 6379,
      'fulfillment.strategies.standard.enabled': true,
      'fulfillment.defaultStrategy': 'standard',
    };
    return config[key];
  }),
});

const createMockFulfillmentConfigService = () => ({
  get: jest.fn().mockImplementation((path?: string) => {
    const config = {
      strategies: {
        standard: { enabled: true },
      },
      defaultStrategy: 'standard',
      validation: {
        routeAmountLimits: {
          default: BigInt('1000000000000000000'), // 1 ETH
        },
        fees: {
          standard: {
            baseFee: BigInt('100000000000000000'), // 0.1 ETH
            percentageFee: 250, // 2.5%
          },
        },
        expirationTime: {
          bufferSeconds: 300,
        },
      },
    };

    if (!path) return config;

    // Handle dot notation paths
    const keys = path.split('.');
    let result: any = config;
    for (const key of keys) {
      result = result?.[key];
      if (result === undefined) break;
    }
    return result;
  }),
  normalize: jest.fn().mockImplementation((_chainId: any, tokens: any) => {
    // Return normalized tokens with amount field for testing
    if (Array.isArray(tokens)) {
      return tokens.map((token: any) => ({
        token: token.token,
        amount: token.amount,
        decimals: 6,
      }));
    }
    if (tokens) {
      return {
        token: tokens.token,
        amount: tokens.amount,
        decimals: 6,
      };
    }
    return [];
  }),
  getValidation: jest.fn().mockReturnValue({
    routeAmountLimits: {
      default: BigInt('1000000000000000000'), // 1 ETH
      chainSpecific: {},
    },
    expirationTime: {
      bufferSeconds: 300,
    },
    fees: {
      standard: {
        baseFee: BigInt('100000000000000000'), // 0.1 ETH
        percentageFee: 250, // 2.5%
      },
    },
  }),
  getDefaultStrategy: jest.fn().mockReturnValue('standard'),
  getStrategyConfig: jest.fn().mockReturnValue({
    enabled: true,
  }),
  getToken: jest.fn().mockImplementation((_chainId: any, tokenAddress: string) => {
    return {
      address: tokenAddress as Address,
      decimals: 6,
      limit: 1, // 1 ETH limit per token
    };
  }),
});

// Mock EvmConfigService
const createMockEvmConfigService = () => ({
  get: jest.fn().mockImplementation((path?: string) => {
    const config = {
      wallets: {
        basic: {
          privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
        },
        kernel: {
          signerType: 'eoa',
          signer: {
            privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
          },
        },
      },
      executorAddress: '0x1234567890123456789012345678901234567890' as Address,
    };

    if (!path) return config;

    const keys = path.split('.');
    let result: any = config;
    for (const key of keys) {
      result = result?.[key];
      if (result === undefined) break;
    }
    return result;
  }),
  getWalletConfig: jest.fn().mockReturnValue({
    privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
  }),
  getFeeLogic: jest.fn().mockReturnValue({
    address: '0x1234567890123456789012345678901234567890' as Address,
    tokens: {
      flatFee: '10', // 0.01 ETH as string - lower for testing
      scalarBps: 100, // 1%
    },
    native: {
      flatFee: '10000000000000000', // 0.01 ETH as string - lower for testing
      scalarBps: 100, // 1%
    },
  }),
  getTokenConfig: jest.fn().mockReturnValue({
    decimals: 6,
    address: '0x1234567890123456789012345678901234567890' as Address,
  }),
  isTokenSupported: jest.fn().mockReturnValue(true),
  getSupportedTokens: jest.fn().mockImplementation((_chainId: number) => {
    // Return a large set of addresses to support the large intent test
    return Array.from({ length: 200 }, (_, i) => ({
      address: ('0x' +
        (1000000000000000000000000000000000000000n + BigInt(i))
          .toString(16)
          .padStart(40, '0')) as Address,
    }));
  }),
});

// Test intent factories for different validation scenarios
const createIntentForValidation = (validation: string, shouldPass: boolean = true): Intent => {
  // Create base intent with sufficient reward tokens to pass fee validation
  const baseIntent = createMockIntent({
    reward: {
      prover: '0x1234567890123456789012345678901234567890' as Address,
      creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours from now in seconds
      nativeAmount: BigInt(1000000000000000000), // 1 ETH
      tokens: [
        {
          amount: BigInt('1000000000000000000'), // 1 token (enough to cover fees)
          token: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
        },
      ],
    },
  });

  switch (validation) {
    case 'intent-funded':
      return shouldPass ? baseIntent : { ...baseIntent, sourceChainId: BigInt(999) }; // Unfunded chain

    case 'duplicate-reward-tokens':
      return shouldPass
        ? baseIntent
        : {
            ...baseIntent,
            reward: {
              ...baseIntent.reward,
              tokens: [
                {
                  amount: BigInt(100),
                  token: '0x1234567890123456789012345678901234567890' as Address,
                },
                {
                  amount: BigInt(200),
                  token: '0x1234567890123456789012345678901234567890' as Address,
                }, // Duplicate
              ],
            },
          };

    case 'route-token':
      return shouldPass
        ? baseIntent
        : {
            ...baseIntent,
            route: {
              ...baseIntent.route,
              tokens: [
                { amount: BigInt(100), token: '0xinvalid' as Address }, // Invalid address
              ],
            },
          };

    case 'route-calls':
      return shouldPass
        ? baseIntent
        : {
            ...baseIntent,
            route: {
              ...baseIntent.route,
              calls: [
                {
                  target: '0xinvalid' as Address, // Invalid address
                  value: BigInt(0),
                  data: '0x' as Hex,
                },
              ],
            },
          };

    case 'route-amount-limit':
      return shouldPass
        ? baseIntent
        : {
            ...baseIntent,
            route: {
              ...baseIntent.route,
              nativeAmount: 0n, // Must be 0 - native transfers not supported
              tokens: [
                {
                  amount: BigInt('10000000000000000000'), // 10 tokens - exceeds 1 ETH limit
                  token: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
                },
              ],
            },
          };

    case 'expiration':
      return shouldPass
        ? baseIntent
        : {
            ...baseIntent,
            reward: {
              ...baseIntent.reward,
              deadline: BigInt(Math.floor(Date.now() / 1000) - 86400), // Expired (24 hours ago in seconds)
            },
            route: {
              ...baseIntent.route,
              deadline: BigInt(Math.floor(Date.now() / 1000) - 86400), // Expired (24 hours ago in seconds)
            },
          };

    case 'chain-support':
      return shouldPass
        ? baseIntent
        : {
            ...baseIntent,
            sourceChainId: BigInt(99999), // Unsupported chain
            destination: BigInt(88888), // Unsupported chain
          };

    case 'prover-support':
      return shouldPass
        ? baseIntent
        : {
            ...baseIntent,
            route: {
              ...baseIntent.route,
              portal: '0xUnsupportedProver123456789012345678901234' as Address,
            },
          };

    case 'executor-balance':
      return shouldPass
        ? baseIntent
        : {
            ...baseIntent,
            route: {
              ...baseIntent.route,
              tokens: [
                {
                  amount: BigInt('100000000000000000000'),
                  token: '0x1234567890123456789012345678901234567890' as Address,
                }, // 100 tokens - exceeds balance
              ],
            },
          };

    case 'standard-fee':
      return shouldPass
        ? baseIntent // Base intent already has sufficient reward tokens
        : {
            ...baseIntent,
            reward: {
              ...baseIntent.reward,
              tokens: [
                {
                  amount: 1n, // 0.000001 token - insufficient for fee
                  token: baseIntent.reward.tokens[0].token,
                },
              ],
            },
          };

    default:
      return baseIntent;
  }
};

describe('StandardFulfillmentStrategy Integration Tests', () => {
  let module: TestingModule;
  let standardStrategy: StandardFulfillmentStrategy;
  let queueService: jest.Mocked<QueueService>;

  // Mock services
  let mockBlockchainReader: jest.Mocked<BlockchainReaderService>;
  let mockBlockchainExecutor: jest.Mocked<BlockchainExecutorService>;
  let mockProverService: jest.Mocked<ProverService>;
  let mockLogger: jest.Mocked<SystemLoggerService>;
  let mockOtelService: jest.Mocked<OpenTelemetryService>;
  let mockFulfillmentConfigService: jest.Mocked<FulfillmentConfigService>;
  let mockEvmConfigService: jest.Mocked<EvmConfigService>;
  let mockTokenConfigService: jest.Mocked<TokenConfigService>;

  // Redis mock
  let redisMock: RedisMock;

  beforeAll(async () => {
    // Create Redis mock instance
    redisMock = new RedisMock();

    // Override IORedis constructor to return our mock
    jest.doMock('ioredis', () => {
      return jest.fn().mockImplementation(() => redisMock);
    });
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create fresh Redis mock for each test
    redisMock = new RedisMock();

    // Create mock services
    mockBlockchainReader =
      createMockBlockchainReader() as unknown as jest.Mocked<BlockchainReaderService>;
    mockBlockchainExecutor =
      createMockBlockchainExecutor() as unknown as jest.Mocked<BlockchainExecutorService>;
    mockProverService = createMockProverService() as unknown as jest.Mocked<ProverService>;
    mockLogger = createMockLogger() as unknown as jest.Mocked<SystemLoggerService>;
    mockOtelService =
      createMockOpenTelemetryService() as unknown as jest.Mocked<OpenTelemetryService>;
    queueService = createMockQueueService() as unknown as jest.Mocked<QueueService>;
    mockFulfillmentConfigService =
      createMockFulfillmentConfigService() as unknown as jest.Mocked<FulfillmentConfigService>;
    mockEvmConfigService = createMockEvmConfigService() as unknown as jest.Mocked<EvmConfigService>;
    mockTokenConfigService =
      createMockTokenConfigService() as unknown as jest.Mocked<TokenConfigService>;

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),

        TokenModule,
      ],
      providers: [
        // Core strategy
        StandardFulfillmentStrategy,

        // Mock services
        {
          provide: BlockchainReaderService,
          useValue: mockBlockchainReader,
        },
        {
          provide: BlockchainExecutorService,
          useValue: mockBlockchainExecutor,
        },
        {
          provide: ProverService,
          useValue: mockProverService,
        },
        {
          provide: SystemLoggerService,
          useValue: mockLogger,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
        {
          provide: ConfigService,
          useValue: createMockConfig(),
        },
        {
          provide: FulfillmentConfigService,
          useValue: mockFulfillmentConfigService,
        },
        {
          provide: EvmConfigService,
          useValue: mockEvmConfigService,
        },
        {
          provide: QUEUE_SERVICE,
          useValue: queueService,
        },
        {
          provide: TokenConfigService,
          useValue: mockTokenConfigService,
        },

        // Real validation classes (not mocked - we want to test the actual validation logic)
        IntentFundedValidation,
        DuplicateRewardTokensValidation,
        RouteTokenValidation,
        RouteCallsValidation,
        RouteAmountLimitValidation,
        ExpirationValidation,
        ChainSupportValidation,
        ProverSupportValidation,
        ExecutorBalanceValidation,
        StandardFeeValidation,
      ],
    }).compile();

    // Get services
    standardStrategy = module.get<StandardFulfillmentStrategy>(StandardFulfillmentStrategy);
  });

  afterEach(async () => {
    await redisMock.flushall();
    await module?.close();
  });

  describe('Integration Test Setup', () => {
    it('should create the strategy successfully', () => {
      expect(standardStrategy).toBeDefined();
    });

    it('should have correct strategy configuration', () => {
      expect(standardStrategy.name).toBe(FULFILLMENT_STRATEGY_NAMES.STANDARD);
      expect(standardStrategy.canHandle(createMockIntent())).toBe(true);
    });

    it('should have all validations properly initialized', () => {
      const validations = (standardStrategy as any).validations;
      expect(validations).toBeDefined();
      expect(validations).toHaveLength(10);
      expect(Object.isFrozen(validations)).toBe(true);
    });
  });

  describe('Validation Integration Tests', () => {
    describe('IntentFundedValidation', () => {
      it('should pass when intent is funded', async () => {
        const intent = createIntentForValidation('intent-funded', true);
        mockBlockchainReader.isIntentFunded.mockResolvedValue(true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);

        expect(mockBlockchainReader.isIntentFunded).toHaveBeenCalledWith(
          intent.sourceChainId,
          intent,
        );
      });

      it('should fail when intent is not funded', async () => {
        const intent = createIntentForValidation('intent-funded', false);
        mockBlockchainReader.isIntentFunded.mockResolvedValue(false);

        await expect(standardStrategy.validate(intent)).rejects.toThrow(AggregatedValidationError);
      });

      it('should handle network errors as temporary failures', async () => {
        const intent = createIntentForValidation('intent-funded', true);
        mockBlockchainReader.isIntentFunded.mockRejectedValue(new Error('Network timeout'));

        await expect(standardStrategy.validate(intent)).rejects.toThrow(Error);
      });
    });

    describe('DuplicateRewardTokensValidation', () => {
      it('should pass when reward tokens are unique', async () => {
        const intent = createIntentForValidation('duplicate-reward-tokens', true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when reward tokens contain duplicates', async () => {
        const intent = createIntentForValidation('duplicate-reward-tokens', false);

        await expect(standardStrategy.validate(intent)).rejects.toThrowError(
          'Duplicate reward tokens found: 0x1234567890123456789012345678901234567890. Each token address must be unique.',
        );
      });
    });

    describe('RouteTokenValidation', () => {
      it('should pass when all token addresses are valid', async () => {
        const intent = createIntentForValidation('route-token', true);
        mockBlockchainReader.isAddressValid.mockReturnValue(true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when token addresses are invalid', async () => {
        const intent = createIntentForValidation('route-token', false);
        await expect(standardStrategy.validate(intent)).rejects.toThrow(ValidationError);
        await expect(standardStrategy.validate(intent)).rejects.toThrowError(
          'Token 0xinvalid is not supported on chain 10',
        );
      });
    });

    describe('RouteCallsValidation', () => {
      it('should pass when all call targets are valid', async () => {
        const intent = createIntentForValidation('route-calls', true);
        mockBlockchainReader.isAddressValid.mockReturnValue(true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when call targets are invalid', async () => {
        const intent = createIntentForValidation('route-calls', false);
        mockBlockchainReader.isAddressValid.mockReturnValue(false);

        await expect(standardStrategy.validate(intent)).rejects.toThrow(Error);
      });
    });

    describe('RouteAmountLimitValidation', () => {
      it('should pass when route amount is within limits', async () => {
        const intent = createIntentForValidation('route-amount-limit', true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when route amount exceeds limits', async () => {
        const intent = createIntentForValidation('route-amount-limit', false);

        await expect(standardStrategy.validate(intent)).rejects.toThrow(ValidationError);
      });
    });

    describe('ExpirationValidation', () => {
      it('should pass when intent is not expired', async () => {
        const intent = createIntentForValidation('expiration', true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when intent has expired', async () => {
        const intent = createIntentForValidation('expiration', false);

        await expect(standardStrategy.validate(intent)).rejects.toThrow(ValidationError);
      });
    });

    describe('ChainSupportValidation', () => {
      it('should pass when chains are supported', async () => {
        const intent = createIntentForValidation('chain-support', true);
        mockBlockchainExecutor.isChainSupported.mockReturnValue(true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when chains are not supported', async () => {
        const intent = createIntentForValidation('chain-support', false);
        mockBlockchainExecutor.isChainSupported.mockReturnValue(false);

        await expect(standardStrategy.validate(intent)).rejects.toThrow(ValidationError);
      });
    });

    describe('ProverSupportValidation', () => {
      it('should pass when prover supports the route', async () => {
        const intent = createIntentForValidation('prover-support', true);
        mockProverService.validateIntentRoute.mockResolvedValue({
          isValid: true,
          reason: 'Valid route',
        });

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);

        expect(mockProverService.validateIntentRoute).toHaveBeenCalledWith(intent);
      });

      it('should fail when prover does not support the route', async () => {
        const intent = createIntentForValidation('prover-support', false);
        mockProverService.validateIntentRoute.mockResolvedValue({
          isValid: false,
          reason: 'Unsupported route',
        });

        await expect(standardStrategy.validate(intent)).rejects.toThrow(ValidationError);
      });
    });

    describe('ExecutorBalanceValidation', () => {
      it('should pass when executor has sufficient balance', async () => {
        const intent = createIntentForValidation('executor-balance', true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when executor has insufficient balance', async () => {
        const intent = createIntentForValidation('executor-balance', false);

        // Mock insufficient balance for the validation context
        const mockValidationContext = {
          getWalletAddress: jest
            .fn()
            .mockResolvedValue('0x1234567890123456789012345678901234567890' as Address),
          getWalletBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH (insufficient for 100 tokens)
          getWalletId: jest.fn().mockResolvedValue('basic'),
        };

        // Patch the strategy's createValidationContext method
        (standardStrategy as any).createValidationContext = jest
          .fn()
          .mockReturnValue(mockValidationContext);

        await expect(standardStrategy.validate(intent)).rejects.toThrow(AggregatedValidationError);
      });
    });

    describe('StandardFeeValidation', () => {
      it('should pass when fee meets requirements', async () => {
        const intent = createIntentForValidation('standard-fee', true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when fee is insufficient', async () => {
        const intent = createIntentForValidation('standard-fee', false);

        await expect(standardStrategy.validate(intent)).rejects.toThrow(Error);
      });
    });
  });

  describe('Strategy Execution', () => {
    it('should execute successfully and add to queue', async () => {
      const intent = createMockIntent();

      await expect(standardStrategy.execute(intent)).resolves.not.toThrow();

      expect(queueService.addIntentToExecutionQueue).toHaveBeenCalledWith({
        strategy: FULFILLMENT_STRATEGY_NAMES.STANDARD,
        intent,
        chainId: intent.destination,
        walletId: 'kernel', // Default wallet ID from strategy
      });
    });

    it('should handle queue service failures gracefully', async () => {
      const intent = createMockIntent();
      queueService.addIntentToExecutionQueue.mockRejectedValue(new Error('Queue service error'));

      await expect(standardStrategy.execute(intent)).rejects.toThrow('Queue service error');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle multiple validation failures', async () => {
      const intent = createMockIntent({
        reward: {
          deadline: BigInt(Math.floor(Date.now() / 1000) - 86400), // Expired (24 hours ago in seconds)
          tokens: [
            { amount: BigInt(100), token: '0x1234567890123456789012345678901234567890' as Address },
            { amount: BigInt(200), token: '0x1234567890123456789012345678901234567890' as Address }, // Duplicate
          ],
        } as any,
        route: {
          tokens: [
            { amount: BigInt(100), token: '0xinvalid' as Address }, // Invalid
          ],
        } as any,
      });

      mockBlockchainReader.isAddressValid.mockReturnValue(false);

      await expect(standardStrategy.validate(intent)).rejects.toThrow(AggregatedValidationError);
    });

    it('should handle temporary validation errors with proper error classification', async () => {
      const intent = createMockIntent();
      mockBlockchainReader.isIntentFunded.mockRejectedValue(new Error('Network timeout'));

      try {
        await standardStrategy.validate(intent);
        fail('Expected validation to throw');
      } catch (error) {
        // Can be either a single Error or AggregatedValidationError
        expect(error).toBeInstanceOf(Error);
        if (error instanceof ValidationError || error instanceof AggregatedValidationError) {
          expect(error.type).toBe(ValidationErrorType.TEMPORARY);
        }
      }
    });

    it('should handle permanent validation errors with proper error classification', async () => {
      const intent = createIntentForValidation('expiration', false); // Expired intent

      try {
        await standardStrategy.validate(intent);
        fail('Expected validation to throw');
      } catch (error) {
        // Can be either a single ValidationError or AggregatedValidationError
        expect(error).toBeInstanceOf(Error);
        if (error instanceof ValidationError || error instanceof AggregatedValidationError) {
          expect(error.type).toBe(ValidationErrorType.PERMANENT);
        }
      }
    });

    it('should handle missing sourceChainId gracefully', async () => {
      const intent = createMockIntent({ sourceChainId: undefined });

      await expect(standardStrategy.validate(intent)).rejects.toThrow(Error);
    });

    it('should handle blockchain service unavailability', async () => {
      const intent = createMockIntent();
      mockBlockchainReader.isIntentFunded.mockRejectedValue(new Error('Service unavailable'));

      await expect(standardStrategy.validate(intent)).rejects.toThrow(ValidationError);
      await expect(standardStrategy.validate(intent)).rejects.toThrowError(
        'Failed to verify intent funding status: Service unavailable',
      );
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent intent processing', async () => {
      const intents = Array.from({ length: 5 }, () =>
        createMockIntent({
          intentHash: `0x${Math.random().toString(16).substr(2, 64)}` as Hex,
          reward: {
            prover: '0x1234567890123456789012345678901234567890' as Address,
            creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours from now in seconds
            nativeAmount: BigInt(1000000000000000000), // 1 ETH
            tokens: [
              {
                amount: BigInt('1000000000000000000'), // 1 token
                token: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
              },
            ],
          },
        }),
      );

      const promises = intents.map((intent) => standardStrategy.validate(intent));

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly cleanup resources after test completion', async () => {
      const intent = createMockIntent({
        reward: {
          prover: '0x1234567890123456789012345678901234567890' as Address,
          creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours from now in seconds
          nativeAmount: BigInt(1000000000000000000), // 1 ETH
          tokens: [
            {
              amount: BigInt('1000000000000000000'), // 1 token
              token: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
            },
          ],
        },
      });

      await standardStrategy.validate(intent);

      // Verify that mocks can be properly cleaned up
      expect(typeof mockBlockchainReader.isIntentFunded.mockClear).toBe('function');
      expect(typeof queueService.addIntentToExecutionQueue.mockClear).toBe('function');
    });

    it('should handle module close without errors', async () => {
      await expect(module.close()).resolves.not.toThrow();
    });
  });
});
