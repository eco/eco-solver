import { Test } from '@nestjs/testing';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { BlockchainConfigService, FulfillmentConfigService } from '@/modules/config/services';
import { FeeResolverService } from '@/modules/config/services/fee-resolver.service';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { StandardFeeValidation } from '../standard-fee.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

// Helper function to cast string to UniversalAddress
const toUniversalAddress = (address: string): UniversalAddress => address as UniversalAddress;

describe('StandardFeeValidation', () => {
  let validation: StandardFeeValidation;
  let blockchainConfigService: jest.Mocked<BlockchainConfigService>;

  beforeEach(async () => {
    const mockBlockchainConfigService = {
      getFeeLogic: jest.fn(),
    };

    const mockFulfillmentConfigService = {
      normalize: jest.fn((chainId: any, tokens: any) => {
        // Simulate normalization from 6 to 18 decimals (multiply by 10^12)
        return tokens.map((token: any) => ({
          ...token,
          amount: token.amount * 10n ** 12n,
        }));
      }),
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
    };
    const module = await Test.createTestingModule({
      providers: [
        StandardFeeValidation,
        {
          provide: BlockchainConfigService,
          useValue: mockBlockchainConfigService,
        },
        {
          provide: FeeResolverService,
          useValue: {
            // Bridge to old behavior: pull tokens from getFeeLogic
            resolveTokenFee: jest.fn((destinationChainId: any) => {
              const logic = mockBlockchainConfigService.getFeeLogic(destinationChainId);
              return logic?.tokens;
            }),
          },
        },
        {
          provide: TokenConfigService,
          useValue: {
            normalize: jest.fn((chainId: any, tokens: any) => {
              // Simulate normalization from 6 to 18 decimals (multiply by 10^12)
              if (Array.isArray(tokens)) {
                return tokens.map((t: any) => ({
                  ...t,
                  decimals: 18,
                  amount: t.amount * 10n ** 12n,
                }));
              }
              return { ...tokens, decimals: 18, amount: tokens.amount * 10n ** 12n };
            }),
          },
        },
        {
          provide: FulfillmentConfigService,
          useValue: mockFulfillmentConfigService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<StandardFeeValidation>(StandardFeeValidation);
    blockchainConfigService = module.get(BlockchainConfigService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    const mockFeeLogic = {
      tokens: {
        flatFee: 0.01, // 0.01 USDC flat fee (will be parsed with parseUnits)
        scalarBps: 1, // 1 = 100 bps = 1%, but actual calculation: (1 * 10000) / (10000 * 10000) = 0.01%
      },
      nonSwapTokens: {
        flatFee: 0.01,
        scalarBps: 1,
      },
      native: {
        flatFee: 0.1, // 0.1 native flat fee (not used in token tests)
        scalarBps: 1, // 1 = 100 bps = 1%, but actual calculation: (1 * 10000) / (10000 * 10000) = 0.01%
      },
    } as any;

    beforeEach(() => {
      blockchainConfigService.getFeeLogic.mockReturnValue(mockFeeLogic);
    });

    describe('fee calculation', () => {
      it('should pass when reward covers base fee plus percentage fee', async () => {
        const intentWithRewardTokens = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(1000000),
              }, // 1 USDC (6 decimals)
            ],
          },
        });

        const result = await validation.validate(intentWithRewardTokens, mockContext);

        expect(result).toBe(true);
      });

      it('should calculate percentage fee from route tokens only (single route token)', async () => {
        const intentWithMultipleValues = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(500000),
              }, // 0.5 USDC reward (6 decimals)
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(300000),
              }, // 0.3 USDC (6 decimals)
            ],
          },
        });

        // Route tokens value: 0.3 USDC (normalized to 18 decimals: 300000000000000000)
        // Base fee: 0.01 USDC (normalized: 10000000000000000)
        // Percentage fee: 1% of 0.3 USDC = 0.003 USDC (normalized: 3000000000000000)
        // Total fee: 0.013 USDC (normalized: 13000000000000000)
        // Reward tokens: 0.5 USDC (normalized: 500000000000000000) > Total fee

        const result = await validation.validate(intentWithMultipleValues, mockContext);

        expect(result).toBe(true);
      });

      it('should handle percentage fee calculation with precision', async () => {
        const precisionIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt('515001'), // Slightly over minimum required (6 decimals)
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(500000),
              }, // 0.5 USDC (6 decimals)
            ],
          },
        });

        // Route tokens value: 0.5 USDC (normalized: 500000000000000000)
        // Base fee: 0.01 USDC (parseUnits('0.01', 18) = 10000000000000000)
        // Percentage fee: 1% of 0.5 USDC = 0.005 USDC (normalized: 5000000000000000)
        // Total required: route value + base + percentage = 500000000000000000 + 10000000000000000 + 5000000000000000 = 515000000000000000
        // Reward tokens: 515001 * 10^12 = 515001000000000000 (slightly over minimum)

        const result = await validation.validate(precisionIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('fee validation failures', () => {
      it('should throw error when route native amount is not zero', async () => {
        const intentWithNativeAmount = createMockIntent({
          route: {
            ...mockIntent.route,
            nativeAmount: BigInt(1000000), // 1 USDC worth of native tokens
          },
        });

        await expect(validation.validate(intentWithNativeAmount, mockContext)).rejects.toThrow(
          'Route native amount must be zero',
        );
      });

      it('should throw error even with small native amount', async () => {
        const intentWithSmallNativeAmount = createMockIntent({
          route: {
            ...mockIntent.route,
            nativeAmount: BigInt(1), // Even 1 wei should fail
          },
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(10000000), // Large reward amount
              },
            ],
          },
        });

        await expect(validation.validate(intentWithSmallNativeAmount, mockContext)).rejects.toThrow(
          'Route native amount must be zero',
        );
      });

      it('should throw error when reward is less than total fee', async () => {
        const lowRewardIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(5000), // 0.005 USDC (6 decimals)
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(1000000), // 1 USDC (6 decimals)
              },
            ],
          },
        });

        // Route tokens value: 1 USDC (normalized: 1000000000000000000)
        // Reward tokens: 0.005 USDC (normalized: 5000000000000000)
        // Base fee: 0.01 USDC (parseUnits('0.01', 18) = 10000000000000000)
        // Percentage fee: scalarBps=1 means 0.01% of reward (0.005 USDC) = 500000000000
        // Total fee: 10000000000000000 + 500000000000 = 10000500000000000
        // Maximum tokens: 5000000000000000 - 10000500000000000 = 0 (negative becomes 0)
        // Route tokens > maximum tokens, so it should throw

        await expect(validation.validate(lowRewardIntent, mockContext)).rejects.toThrow(
          'Route amount 1000000000000000000 exceeds maximum 0',
        );
      });

      it('should throw error when reward exactly equals total fee minus 1 wei', async () => {
        // Fee calculation with new logic:
        // Route value: 1000000 * 10^12 = 1000000000000000000 (1 USDC normalized)
        // Reward: 1010099 * 10^12 = 1010099000000000000
        // Base fee: parseUnits('0.01', 18) = 10000000000000000
        // Percentage fee from reward: (1010099000000000000 * 10000) / 100000000 = 101009900000000
        // Total fee: 10000000000000000 + 101009900000000 = 10101009900000000
        // Maximum: 1010099000000000000 - 10101009900000000 = 999997990100000000
        // Route (1000000000000000000) > Maximum (999997990100000000), so should throw

        const almostEnoughIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt('1010099'), // Slightly less than required
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(1000000), // 1 USDC (6 decimals)
              },
            ],
          },
        });

        await expect(validation.validate(almostEnoughIntent, mockContext)).rejects.toThrow(
          'Route amount 1000000000000000000 exceeds maximum 999997990100000000',
        );
      });

      it('should pass when reward covers route plus fees', async () => {
        // With new calculation: we need reward to be high enough that (reward - fees) >= route
        // Route: 1 USDC = 1000000000000000000
        // We need a reward such that when fees are subtracted, we still have >= route amount
        // Let's use 1.02 USDC reward (more than route + fees)
        const sufficientIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(1020000), // 1.02 USDC - enough to cover route + fees
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(1000000), // 1 USDC (6 decimals)
              },
            ],
          },
        });

        const result = await validation.validate(sufficientIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('different fee configurations', () => {
      it('should use resolver-provided fee (nonSwapTokens) when returned', async () => {
        (validation as any).feeResolverService = {
          resolveTokenFee: jest.fn(() => ({ flatFee: 0.02, scalarBps: 0 })),
        } as unknown as FeeResolverService;

        const intent = createMockIntent({
          reward: {
            ...createMockIntent().reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001234567890123456789012345678901234567890',
                ),
                amount: BigInt('1500000'), // 1.5 USDC to cover 0.02 base
              },
            ],
          },
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001234567890123456789012345678901234567890',
                ),
                amount: BigInt('1000000'), // 1 unit
              },
            ],
          },
        });

        const result = await validation.validate(intent, mockContext);
        expect(result).toBe(true);
      });
      it('should handle zero base fee', async () => {
        blockchainConfigService.getFeeLogic.mockReturnValue({
          tokens: {
            flatFee: 0,
            scalarBps: 2, // 2% = 200 bps
          },
          nonSwapTokens: {
            flatFee: 0,
            scalarBps: 2,
          },
          native: {
            flatFee: 0,
            scalarBps: 2, // 2% = 200 bps
          },
        } as any);

        const intentWithTokens = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(1020000), // Need 1.02 USDC to cover route + fees
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(1000000), // 1 USDC (6 decimals)
              },
            ],
          },
        });

        // Route tokens value: 1 USDC (normalized: 1000000000000000000)
        // Base fee: 0
        // Percentage fee: 2% of 1 USDC = 0.02 USDC (normalized: 20000000000000000)
        // Total required: route value + fees = 1000000000000000000 + 20000000000000000 = 1020000000000000000
        // Reward: 0.03 USDC (normalized: 30000000000000000) - not enough!

        const result = await validation.validate(intentWithTokens, mockContext);

        expect(result).toBe(true);
      });

      it('should handle zero percentage fee', async () => {
        blockchainConfigService.getFeeLogic.mockReturnValue({
          tokens: {
            flatFee: 0.05, // 0.05 USDC normalized to 18 decimals
            scalarBps: 0,
          },
          nonSwapTokens: {
            flatFee: 0.05,
            scalarBps: 0,
          },
          native: {
            flatFee: 0.05, // 0.05 USDC normalized to 18 decimals
            scalarBps: 0,
          },
        } as any);

        const intentWithTokens = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(150000), // Need 0.15 USDC to cover route + base fee
              },
            ],
          },
        });

        // Route tokens value: Default mock has 100000 * 10^12 = 100000000000000000 (0.1 USDC normalized)
        // Base fee: 0.05 USDC (normalized: 50000000000000000)
        // Percentage fee: 0% of 0.1 USDC = 0
        // Total required: route value + base fee = 100000000000000000 + 50000000000000000 = 150000000000000000
        // Reward: 0.06 USDC (normalized: 60000000000000000) - not enough!

        const result = await validation.validate(intentWithTokens, mockContext);

        expect(result).toBe(true);
      });

      it('should handle both zero fees with tokens present', async () => {
        blockchainConfigService.getFeeLogic.mockReturnValue({
          tokens: {
            flatFee: 0,
            scalarBps: 0,
          },
          nonSwapTokens: {
            flatFee: 0,
            scalarBps: 0,
          },
          native: {
            flatFee: 0,
            scalarBps: 0,
          },
        } as any);

        // Intent should have both route and reward tokens even with zero fees
        // With zero fees, still need to cover the route tokens amount
        const zeroFeeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(100000), // Need to cover default route tokens (100000)
              },
            ],
          },
        });

        const result = await validation.validate(zeroFeeIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle high percentage fees', async () => {
        blockchainConfigService.getFeeLogic.mockReturnValue({
          tokens: {
            flatFee: 0,
            scalarBps: 50, // 50% = 5000 bps
          },
          nonSwapTokens: {
            flatFee: 0,
            scalarBps: 50,
          },
          native: {
            flatFee: 0,
            scalarBps: 50, // 50% = 5000 bps
          },
        } as any);

        const highFeeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(1500000), // Need 1.5 USDC to cover route + fee
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(1000000), // 1 USDC (6 decimals)
              },
            ],
          },
        });

        // Route tokens value: 1 USDC (normalized: 1000000000000000000)
        // Percentage fee: 50% of 1 USDC = 0.5 USDC (normalized: 500000000000000000)
        // Total required: route value + fee = 1000000000000000000 + 500000000000000000 = 1500000000000000000
        // Reward: 0.6 USDC (normalized: 600000000000000000) - not enough!

        const result = await validation.validate(highFeeIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle very large numbers', async () => {
        const largeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt('5060000000'), // Need 5060 USDC to cover route + fees
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt('5000000000'),
              }, // 5000 USDC (6 decimals)
            ],
          },
        });

        blockchainConfigService.getFeeLogic.mockReturnValue({
          tokens: {
            flatFee: 10, // 10 USDC normalized to 18 decimals
            scalarBps: 1, // 1% = 100 bps
          },
          nonSwapTokens: {
            flatFee: 10,
            scalarBps: 1,
          },
          native: {
            flatFee: 10, // 10 USDC normalized to 18 decimals
            scalarBps: 1, // 1% = 100 bps
          },
        } as any);

        // Route tokens value: 5000 USDC (normalized: 5000000000000000000000)
        // Base fee: 10 USDC (normalized: 10000000000000000000)
        // Percentage fee: 1% of 5000 = 50 USDC (normalized: 50000000000000000000)
        // Total required: route value + fees = 5000000000000000000000 + 10000000000000000000 + 50000000000000000000 = 5060000000000000000000
        // Reward: 1000 USDC (normalized: 1000000000000000000000) - not enough!

        const result = await validation.validate(largeIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should fail when route tokens are missing even with zero fees', async () => {
        const noRouteTokensIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(1000),
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [],
          },
        });

        blockchainConfigService.getFeeLogic.mockReturnValue({
          tokens: {
            flatFee: 0,
            scalarBps: 0,
          },
          nonSwapTokens: {
            flatFee: 0,
            scalarBps: 0,
          },
          native: {
            flatFee: 0,
            scalarBps: 0,
          },
        } as any);

        await expect(validation.validate(noRouteTokensIntent, mockContext)).rejects.toThrow(
          'No route tokens found',
        );
      });

      it('should fail when reward tokens are missing even with zero fees', async () => {
        const noRewardTokensIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [],
          },
        });

        blockchainConfigService.getFeeLogic.mockReturnValue({
          tokens: {
            flatFee: 0,
            scalarBps: 0,
          },
          nonSwapTokens: {
            flatFee: 0,
            scalarBps: 0,
          },
          native: {
            flatFee: 0,
            scalarBps: 0,
          },
        } as any);

        await expect(validation.validate(noRewardTokensIntent, mockContext)).rejects.toThrow(
          'No reward tokens found',
        );
      });

      it('should handle percentage calculation rounding', async () => {
        const oddValueIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(343034), // Covers total required with rounding (6 decimals)
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(333), // Odd amount (6 decimals)
              },
            ],
          },
        });

        blockchainConfigService.getFeeLogic.mockReturnValue({
          tokens: {
            flatFee: 0.01, // 0.01 USDC normalized
            scalarBps: 1, // 1% = 100 bps
          },
          nonSwapTokens: {
            flatFee: 0.01,
            scalarBps: 1,
          },
          native: {
            flatFee: 0.01, // 0.01 USDC normalized
            scalarBps: 1, // 1% = 100 bps
          },
        } as any);

        // Route value: 333 * 10^12 = 333000000000000
        // Base fee: parseUnits('0.01', 18) = 10000000000000000
        // Percentage fee: 0.01% of 333000000000000 = 33300000000
        // Total required: 333000000000000 + 10000000000000000 + 33300000000 = 343033300000000
        // Reward: 343034 * 10^12 = 343034000000000000 > 343033300000000

        const result = await validation.validate(oddValueIntent, mockContext);

        expect(result).toBe(true);
      });
    });
  });

  describe('calculateFee method', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    it('should calculate fees correctly with base and percentage', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          tokens: [
            {
              amount: BigInt('5000000'), // 5 USDC reward (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
        route: {
          ...mockIntent.route,
          tokens: [
            {
              amount: BigInt('1000000'), // 1 USDC to transfer (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
      });

      blockchainConfigService.getFeeLogic.mockReturnValue({
        tokens: {
          flatFee: 0.001, // 0.001 USDC (normalized) base fee
          scalarBps: 0.01, // 0.01 * 10000 = 100 / 10000 = 0.01 = 1 bps
        },
        nonSwapTokens: {
          flatFee: 0.001,
          scalarBps: 0.01,
        },
      } as any);

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // With flatFee: 0.001, parseUnits('0.001', 18) = 1000000000000000
      // scalarBps: 0.01 means 0.01 * 10000 = 100, percentageFee = (1000000000000000000 * 100) / 100000000 = 1000000000000
      // percentageFee = (5000000000000000000 * 100) / 1000000 = 5000000000000
      expect(feeDetails).toEqual({
        reward: {
          native: 0n,
          tokens: BigInt('5000000000000000000'), // 5 USDC normalized
        },
        route: {
          native: 0n,
          tokens: BigInt('1000000000000000000'), // 1 USDC normalized
          maximum: {
            native: 0n,
            tokens: BigInt('4998995000000000000'), // reward.tokens - total fee
          },
        },
        fee: {
          base: BigInt('1000000000000000'),
          percentage: BigInt('5000000000000'), // 0.01% of 5 USDC
          total: BigInt('1005000000000000'), // base + percentage
          bps: 0.01,
        },
      });
    });

    it('should handle zero base fee', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          tokens: [
            {
              amount: BigInt('5000000'), // 5 USDC (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
        route: {
          ...mockIntent.route,
          tokens: [
            {
              amount: BigInt('1000000'), // 1 USDC (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
      });

      blockchainConfigService.getFeeLogic.mockReturnValue({
        tokens: {
          flatFee: 0,
          scalarBps: 0.0005, // 0.0005 * 10000 = 5 / 10000 = 0.0005 = 0.05 bps
        },
        nonSwapTokens: {
          flatFee: 0,
          scalarBps: 0.0005,
        },
      } as any);

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Actually with the base = 10_000 multiplier:
      // scalarBpsInt = 0.0005 * 10000 = 5
      // percentageFee = (5000000000000000000 * 5) / (10000 * 10000) = 250000000000
      expect(feeDetails).toEqual({
        reward: {
          native: 0n,
          tokens: BigInt('5000000000000000000'), // 5 USDC normalized
        },
        route: {
          native: 0n,
          tokens: BigInt('1000000000000000000'), // 1 USDC normalized
          maximum: {
            native: 0n,
            tokens: BigInt('4999999750000000000'), // reward.tokens - total fee
          },
        },
        fee: {
          base: BigInt('0'),
          percentage: BigInt('250000000000'), // 0.0005% of 5 USDC
          total: BigInt('250000000000'), // base + percentage
          bps: 0.0005,
        },
      });
    });

    it('should handle zero percentage fee', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          tokens: [
            {
              amount: BigInt('5000000'), // 5 USDC (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
        route: {
          ...mockIntent.route,
          tokens: [
            {
              amount: BigInt('1000000'), // 1 USDC (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
      });

      blockchainConfigService.getFeeLogic.mockReturnValue({
        tokens: {
          flatFee: 0.002,
          scalarBps: 0,
        },
        nonSwapTokens: {
          flatFee: 0.002,
          scalarBps: 0,
        },
      } as any);

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      expect(feeDetails).toEqual({
        reward: {
          native: 0n,
          tokens: BigInt('5000000000000000000'), // 5 USDC normalized
        },
        route: {
          native: 0n,
          tokens: BigInt('1000000000000000000'), // 1 USDC normalized
          maximum: {
            native: 0n,
            tokens: BigInt('4998000000000000000'), // reward.tokens - total fee
          },
        },
        fee: {
          base: BigInt('2000000000000000'),
          percentage: BigInt('0'),
          total: BigInt('2000000000000000'), // base + percentage
          bps: 0,
        },
      });
    });
  });

  describe('validate and calculateFee consistency', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    it('should use the same calculation logic', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          tokens: [
            {
              amount: BigInt('2000000'), // 2 USDC (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
        route: {
          ...mockIntent.route,
          tokens: [
            {
              amount: BigInt('1000000'), // 1 USDC (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
      });

      blockchainConfigService.getFeeLogic.mockReturnValue({
        tokens: {
          flatFee: 0.0015,
          scalarBps: 0.0005, // 0.0005 * 10000 = 5 / 10000 = 0.0005 = 0.05 bps
        },
        nonSwapTokens: {
          flatFee: 0.0015,
          scalarBps: 0.0005,
        },
      } as any);

      // Calculate fee details
      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Reset mocks to ensure validate uses fresh calls
      jest.clearAllMocks();
      blockchainConfigService.getFeeLogic.mockReturnValue({
        tokens: {
          flatFee: 0.0015,
          scalarBps: 0.0005,
        },
        nonSwapTokens: {
          flatFee: 0.0015,
          scalarBps: 0.0005,
        },
      } as any);

      // Validate should pass because currentReward >= totalRequiredFee
      const isValid = await validation.validate(intent, mockContext);

      expect(isValid).toBe(true);
      expect(feeDetails.reward.tokens).toBe(BigInt('2000000000000000000'));
      // Base fee: 1500000000000000, Percentage fee: (2000000000000000000 * 5) / 100000 = 100000000000000
      // Total fee: 1600000000000000
      // Maximum: 2000000000000000000 - 1600000000000000 = 1998400000000000000
      // Actually: scalarBps: 0.0005 * 10000 = 5
      // Percentage fee: (2000000000000000000 * 5) / 100000000 = 100000000000
      // Total fee: 1500000000000000 + 100000000000 = 1500100000000000
      // Maximum: 2000000000000000000 - 1500100000000000 = 1998499900000000000
      expect(feeDetails.route.maximum.tokens).toBe(BigInt('1998499900000000000')); // reward - fees
    });

    it('should pass validation when reward covers the fee using calculateFee', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          tokens: [
            {
              amount: BigInt('5000000'), // 5 USDC reward (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
        route: {
          ...mockIntent.route,
          tokens: [
            {
              amount: BigInt('1000000'), // 1 USDC to transfer (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
      });

      blockchainConfigService.getFeeLogic.mockReturnValue({
        tokens: {
          flatFee: 0.001, // 0.001 USDC (normalized)
          scalarBps: 0.01, // 1 bps = 0.01%
        },
        nonSwapTokens: {
          flatFee: 0.001,
          scalarBps: 0.01,
        },
      } as any);

      const result = await validation.validate(intent, mockContext);

      expect(result).toBe(true);
      expect(blockchainConfigService.getFeeLogic).toHaveBeenCalledWith(BigInt(10));
    });

    it('should throw error when reward does not cover the fee using calculateFee', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          tokens: [
            {
              amount: BigInt('500'), // 0.0005 USDC reward (too low, 6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
        route: {
          ...mockIntent.route,
          tokens: [
            {
              amount: BigInt('1000000'), // 1 USDC to transfer (6 decimals)
              token: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
            },
          ],
        },
      });

      blockchainConfigService.getFeeLogic.mockReturnValue({
        tokens: {
          flatFee: 0.001, // 0.001 USDC (normalized)
          scalarBps: 1, // 100 bps = 1%
        },
        nonSwapTokens: {
          flatFee: 0.001,
          scalarBps: 1,
        },
      } as any);

      // Reward: 500 * 10^12 = 500000000000000
      // Route: 1000000 * 10^12 = 1000000000000000000
      // Base fee: 0.001 * 10^18 = 1000000000000000
      // Percentage fee: (500000000000000 * 10000) / 100000000 = 50000000000
      // Total fee: 1000000000000000 + 50000000000 = 1000050000000000
      // Maximum: 500000000000000 - 1000050000000000 = 0 (negative becomes 0)
      // Route > Maximum, should throw
      await expect(validation.validate(intent, mockContext)).rejects.toThrow(
        'Route amount 1000000000000000000 exceeds maximum 0',
      );
    });
  });
});
