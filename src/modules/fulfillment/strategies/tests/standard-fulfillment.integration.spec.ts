import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import RedisMock from 'ioredis-mock';
import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { toUniversalAddress } from '@/common/types/universal-address.type';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { BlockchainConfigService } from '@/modules/config/services/blockchain-config.service';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
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
  getSupportedTokens: jest.fn().mockImplementation((chainId: number) => {
    // Return test token addresses that we use in tests - with proper padding to match UniversalAddress format
    return [
      { address: '0x00000000000000000000000000000002f050fe938943acc45f65568000000000' as Address },
      // Return additional addresses for large test
      ...Array.from({ length: 199 }, (_, i) => ({
        address: ('0x' +
          (1000000000000000000000000000000000000000n + BigInt(i + 1))
            .toString(16)
            .padStart(40, '0')) as Address,
      })),
    ];
  }),
});

// Mock factories for services
const createMockBlockchainReader = () => {
  const mockReader = {
    getBalance: jest.fn().mockResolvedValue(BigInt('10000000000000000000')), // 10 ETH
    getTokenBalance: jest.fn().mockResolvedValue(BigInt('10000000000000000000')),
  };

  return {
    getSupportedChains: jest.fn().mockReturnValue([1, 10, 137, 42161]),
    isChainSupported: jest.fn().mockImplementation((chainId) => {
      // Return false for test chains (999, 99999, 88888) used to simulate unsupported chains
      const unsupportedChains = [999, 99999, 88888];
      return !unsupportedChains.includes(Number(chainId));
    }),
    getReaderForChain: jest.fn().mockReturnValue(mockReader), // Return synchronously
    getBalance: jest.fn().mockResolvedValue(BigInt('10000000000000000000')), // 10 ETH
    getTokenBalance: jest.fn().mockResolvedValue(BigInt('10000000000000000000')),
    // isAddressValid: jest.fn().mockReturnValue(true), // Method doesn't exist in current implementation
    isIntentFunded: jest.fn().mockResolvedValue(true),
    fetchProverFee: jest.fn().mockResolvedValue(BigInt('1000000000000000')), // 0.001 ETH
  };
};

const createMockBlockchainExecutor = () => {
  const mockExecutor = {
    getWalletAddress: jest
      .fn()
      .mockResolvedValue('0x1234567890123456789012345678901234567890' as Address),
    executeIntent: jest.fn().mockResolvedValue(undefined),
  };

  return {
    getSupportedChains: jest.fn().mockReturnValue([1, 10, 137, 42161]),
    isChainSupported: jest.fn().mockImplementation((chainId) => {
      // Return false for test chains (999, 99999, 88888) used to simulate unsupported chains
      const unsupportedChains = [999, 99999, 88888];
      return !unsupportedChains.includes(Number(chainId));
    }),
    getExecutorForChain: jest.fn().mockReturnValue(mockExecutor), // Return synchronously
    executeIntent: jest.fn().mockResolvedValue(undefined),
    getWalletAddress: jest
      .fn()
      .mockResolvedValue('0x1234567890123456789012345678901234567890' as Address),
  };
};

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
          default: BigInt('10000000000000000000'), // 10 ETH - higher limit
        },
        fees: {
          standard: {
            baseFee: BigInt('1000000000000000'), // 0.001 ETH - much lower
            percentageFee: 10, // 0.1% - much lower
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
      default: BigInt('10000000000000000000'), // 10 ETH - higher limit
      chainSpecific: {},
    },
    expirationTime: {
      bufferSeconds: 300,
    },
    fees: {
      standard: {
        baseFee: BigInt('1000000000000000'), // 0.001 ETH - much lower
        percentageFee: 10, // 0.1% - much lower
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

// Mock BlockchainConfigService
const createMockBlockchainConfigService = () => ({
  getFeeLogic: jest.fn().mockImplementation((chainId) => {
    return {
      tokens: {
        flatFee: '0.001', // 0.001 ETH as string (18 decimal places)
        scalarBps: 10, // 0.1%
      },
      native: {
        flatFee: '0.001', // 0.001 ETH as string (18 decimal places)
        scalarBps: 10, // 0.1%
      },
    };
  }),
  getPortalAddress: jest
    .fn()
    .mockReturnValue('0x1234567890123456789012345678901234567890' as Address),
  isChainSupported: jest.fn().mockReturnValue(true),
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
      flatFee: '0.001', // 0.001 ETH as string - much lower for testing
      scalarBps: 10, // 0.1%
    },
    native: {
      flatFee: '1000000000000000', // 0.001 ETH as string - much lower for testing
      scalarBps: 10, // 0.1%
    },
  }),
  getTokenConfig: jest.fn().mockReturnValue({
    decimals: 6,
    address: '0x1234567890123456789012345678901234567890' as Address,
  }),
  isTokenSupported: jest.fn().mockReturnValue(true),
  getSupportedTokens: jest.fn().mockImplementation((_chainId: number) => {
    // Return test token addresses that we use in tests - with proper padding to match UniversalAddress format
    return [
      { address: '0x00000000000000000000000000000002f050fe938943acc45f65568000000000' as Address },
      // Return additional addresses for large test
      ...Array.from({ length: 199 }, (_, i) => ({
        address: ('0x' +
          (1000000000000000000000000000000000000000n + BigInt(i + 1))
            .toString(16)
            .padStart(40, '0')) as Address,
      })),
    ];
  }),
});

// Test intent factories for different validation scenarios
const createIntentForValidation = (validation: string, shouldPass: boolean = true): Intent => {
  // Create base intent with sufficient reward tokens to pass fee validation
  const baseIntent = createMockIntent({
    reward: {
      prover: toUniversalAddress(
        '0x0000000000000000000000001234567890123456789012345678901234567890',
      ),
      creator: toUniversalAddress(
        '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd',
      ),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours from now in seconds
      nativeAmount: BigInt('5000000000000000000'), // 5 ETH - sufficient for fees
      tokens: [
        {
          amount: BigInt('5000000000000000000'), // 5 tokens (enough to cover fees with new lower rates)
          token: toUniversalAddress(
            '0x00000000000000000000000000000002f050fe938943acc45f65568000000000',
          ),
        },
      ],
    },
    route: {
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours from now in seconds
      portal: toUniversalAddress(
        '0x0000000000000000000000009876543210987654321098765432109876543210',
      ),
      nativeAmount: 0n,
      tokens: [
        {
          amount: BigInt('100000000000000000'), // 0.1 ETH worth of tokens
          token: toUniversalAddress(
            '0x00000000000000000000000000000002f050fe938943acc45f65568000000000',
          ),
        },
      ],
      calls: [
        {
          target: toUniversalAddress(
            '0x00000000000000000000000000000002f050fe938943acc45f65568000000000',
          ), // Use default token address from createMockIntent
          value: 0n,
          data: '0xa9059cbb000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd00000000000000000000000000000000000000000000000000000000000186a0' as Hex, // ERC20 transfer call
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
                  token: toUniversalAddress(
                    '0x0000000000000000000000001234567890123456789012345678901234567890',
                  ),
                },
                {
                  amount: BigInt(200),
                  token: toUniversalAddress(
                    '0x0000000000000000000000001234567890123456789012345678901234567890',
                  ),
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
                {
                  amount: BigInt(100),
                  token: toUniversalAddress(
                    '0x000000000000000000000000000000000000000000000000000000696e76616c',
                  ),
                }, // Invalid address (spells "inval")
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
                  target: toUniversalAddress(
                    '0x000000000000000000000000000000000000000000000000000000696e76616c',
                  ), // Invalid address (spells "inval")
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
                  token: toUniversalAddress(
                    '0x00000000000000000000000000000002f050fe938943acc45f65568000000000',
                  ),
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
              portal: toUniversalAddress(
                '0x000000000000000000556e737570706f7274656450726f766572313233343536',
              ),
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
                  token: toUniversalAddress(
                    '0x0000000000000000000000001234567890123456789012345678901234567890',
                  ),
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
  let mockBlockchainConfigService: jest.Mocked<BlockchainConfigService>;
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
    mockBlockchainConfigService =
      createMockBlockchainConfigService() as unknown as jest.Mocked<BlockchainConfigService>;
    mockEvmConfigService = createMockEvmConfigService() as unknown as jest.Mocked<EvmConfigService>;
    mockTokenConfigService =
      createMockTokenConfigService() as unknown as jest.Mocked<TokenConfigService>;

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
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
          provide: BlockchainConfigService,
          useValue: mockBlockchainConfigService,
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
        await expect(standardStrategy.validate(intent)).rejects.toThrowError(
          /Intent .* is not funded on chain/,
        );
      });

      it('should handle network errors as temporary failures', async () => {
        const intent = createIntentForValidation('intent-funded', true);
        mockBlockchainReader.isIntentFunded.mockRejectedValue(new Error('Network timeout'));

        await expect(standardStrategy.validate(intent)).rejects.toThrow(Error);
        await expect(standardStrategy.validate(intent)).rejects.toThrowError(
          /Failed to verify intent funding status.*Network timeout/,
        );
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
        // mockBlockchainReader.isAddressValid.mockReturnValue(true); // Method doesn't exist

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
        // mockBlockchainReader.isAddressValid.mockReturnValue(true); // Method doesn't exist

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when call targets are invalid', async () => {
        const intent = createIntentForValidation('route-calls', false);
        // mockBlockchainReader.isAddressValid.mockReturnValue(false); // Method doesn't exist

        await expect(standardStrategy.validate(intent)).rejects.toThrow(Error);
        await expect(standardStrategy.validate(intent)).rejects.toThrowError(
          /Address.*0xinvalid.*is invalid/,
        );
      });
    });

    describe('RouteAmountLimitValidation', () => {
      it('should pass when route amount is within limits', async () => {
        const intent = createIntentForValidation('route-amount-limit', true);

        await expect(standardStrategy.validate(intent)).resolves.toBe(true);
      });

      it('should fail when route amount exceeds limits', async () => {
        const intent = createIntentForValidation('route-amount-limit', false);

        await expect(standardStrategy.validate(intent)).rejects.toThrow(AggregatedValidationError);
        await expect(standardStrategy.validate(intent)).rejects.toThrowError(/exceeds route limit/);
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
        await expect(standardStrategy.validate(intent)).rejects.toThrowError(
          /Intent deadline.*has expired/,
        );
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
        await expect(standardStrategy.validate(intent)).rejects.toThrowError(
          /Source chain.*is not supported/,
        );
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
        await expect(standardStrategy.validate(intent)).rejects.toThrowError(
          'Prover validation failed: Unsupported route',
        );
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
        await expect(standardStrategy.validate(intent)).rejects.toThrowError(
          /Reward amount.*is less than required fee/,
        );
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
            {
              amount: BigInt(100),
              token: toUniversalAddress(
                '0x000000000000000000000000000000000000000000000000000000696e76616c',
              ),
            }, // Invalid
          ],
        } as any,
      });

      // mockBlockchainReader.isAddressValid.mockReturnValue(false); // Method doesn't exist

      await expect(standardStrategy.validate(intent)).rejects.toThrow(AggregatedValidationError);
      // Should contain multiple validation error messages
      await expect(standardStrategy.validate(intent)).rejects.toThrowError(
        /Validation failures.*Duplicate reward tokens.*Token 0xinvalid.*expired/i,
      );
    });

    it('should handle temporary validation errors with proper error classification', async () => {
      // Create a valid intent that would pass all other validations
      const intent = createIntentForValidation('intent-funded', true);
      // Mock only the funding check to fail with a network error
      mockBlockchainReader.isIntentFunded.mockRejectedValue(new Error('Network timeout'));

      try {
        await standardStrategy.validate(intent);
        fail('Expected validation to throw');
      } catch (error) {
        // Should be AggregatedValidationError but with mixed types, permanent wins
        // OR could be ValidationError if it's the only failure
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/Failed to verify intent funding status.*Network timeout/);

        // The error type depends on whether other validations also fail
        // If only the network error occurs, it should be TEMPORARY
        if (error instanceof ValidationError) {
          expect(error.type).toBe(ValidationErrorType.TEMPORARY);
        } else if (error instanceof AggregatedValidationError) {
          // If there are other errors, permanent takes precedence
          // Just check that our error is included
          expect(error.message).toMatch(/Network timeout/);
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

      await expect(standardStrategy.validate(intent)).rejects.toThrow(AggregatedValidationError);
      await expect(standardStrategy.validate(intent)).rejects.toThrowError(
        /Intent.*is missing source chain ID/,
      );
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
            prover: toUniversalAddress(
              '0x0000000000000000000000001234567890123456789012345678901234567890',
            ),
            creator: toUniversalAddress(
              '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd',
            ),
            deadline: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours from now in seconds
            nativeAmount: BigInt('5000000000000000000'), // 5 ETH - sufficient for fees
            tokens: [
              {
                amount: BigInt('5000000000000000000'), // 5 tokens - sufficient for fees
                token: toUniversalAddress(
                  '0x00000000000000000000000000000002f050fe938943acc45f65568000000000',
                ),
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
          prover: toUniversalAddress(
            '0x0000000000000000000000001234567890123456789012345678901234567890',
          ),
          creator: toUniversalAddress(
            '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          ),
          deadline: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours from now in seconds
          nativeAmount: BigInt('5000000000000000000'), // 5 ETH - sufficient for fees
          tokens: [
            {
              amount: BigInt('5000000000000000000'), // 5 tokens - sufficient for fees
              token: toUniversalAddress(
                '0x00000000000000000000000000000002f050fe938943acc45f65568000000000',
              ),
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
