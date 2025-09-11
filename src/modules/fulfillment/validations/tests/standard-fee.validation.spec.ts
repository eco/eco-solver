import { Test } from '@nestjs/testing';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { BlockchainConfigService, FulfillmentConfigService } from '@/modules/config/services';
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
        return tokens.map((token: any) => ({ ...token, amount: token.amount * 10n ** 12n }));
      }),
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
    const module = await Test.createTestingModule({
      providers: [
        StandardFeeValidation,
        {
          provide: BlockchainConfigService,
          useValue: mockBlockchainConfigService,
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
      native: {
        flatFee: 0.1, // 0.1 native flat fee (not used in token tests)
        scalarBps: 1, // 1 = 100 bps = 1%, but actual calculation: (1 * 10000) / (10000 * 10000) = 0.01%
      },
    };

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

      it('should calculate percentage fee from route tokens only', async () => {
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
                amount: BigInt(200000),
              }, // 0.2 USDC (6 decimals)
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000002222222222222222222222222222222222222222',
                ),
                amount: BigInt(100000),
              }, // 0.1 USDC (6 decimals)
            ],
          },
        });

        // Route tokens value: 0.2 + 0.1 = 0.3 USDC (normalized to 18 decimals: 300000000000000000)
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
        // Base fee: 0.01 USDC (parseUnits('0.01', 18) = 10000000000000000)
        // Percentage fee: scalarBps=1 means 0.01% of 1 USDC = 0.0001 USDC (100000000000000)
        // Total required: route value + base + percentage = 1000000000000000000 + 10000000000000000 + 100000000000000 = 1010100000000000000
        // Reward tokens: 0.005 USDC (normalized: 5000000000000000) < Total required

        await expect(validation.validate(lowRewardIntent, mockContext)).rejects.toThrow(
          'Reward amount 5000000000000000 is less than required fee 1010100000000000000',
        );
      });

      it('should throw error when reward exactly equals total fee minus 1 wei', async () => {
        // Fee calculation:
        // Base fee: parseUnits('0.01', 18) = 10000000000000000
        // Route value: 1000000 * 10^12 = 1000000000000000000 (1 USDC normalized)
        // scalarBps = 1, base = 10000
        // scalarBpsInt = 1 * 10000 = 10000
        // percentageFee = (1000000000000000000 * 10000) / (10000 * 10000) = 100000000000000
        // Total required = route value + base fee + percentage = 1000000000000000000 + 10000000000000000 + 100000000000000 = 1010100000000000000

        const almostEnoughIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt('1010099'), // Slightly less than required (1010100 - 1)
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
          'Reward amount 1010099000000000000 is less than required fee 1010100000000000000 (base: 10000000000000000, scalar: 100000000000000)',
        );
      });

      it('should pass when reward exactly equals total fee', async () => {
        const exactFeeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                ),
                amount: BigInt(1010100), // Exactly required (route value + fees)
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

        const result = await validation.validate(exactFeeIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('different fee configurations', () => {
      it('should handle zero base fee', async () => {
        blockchainConfigService.getFeeLogic.mockReturnValue({
          tokens: {
            flatFee: 0,
            scalarBps: 2, // 2% = 200 bps
          },
          native: {
            flatFee: 0,
            scalarBps: 2, // 2% = 200 bps
          },
        });

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
          native: {
            flatFee: 0.05, // 0.05 USDC normalized to 18 decimals
            scalarBps: 0,
          },
        });

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
          native: {
            flatFee: 0,
            scalarBps: 0,
          },
        });

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
          native: {
            flatFee: 0,
            scalarBps: 50, // 50% = 5000 bps
          },
        });

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
          native: {
            flatFee: 10, // 10 USDC normalized to 18 decimals
            scalarBps: 1, // 1% = 100 bps
          },
        });

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
          native: {
            flatFee: 0,
            scalarBps: 0,
          },
        });

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
          native: {
            flatFee: 0,
            scalarBps: 0,
          },
        });

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
          native: {
            flatFee: 0.01, // 0.01 USDC normalized
            scalarBps: 1, // 1% = 100 bps
          },
        });

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
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // With flatFee: 0.001, parseUnits('0.001', 18) = 1000000000000000
      // scalarBps: 0.01 means 0.01 * 10000 = 100, percentageFee = (1000000000000000000 * 100) / 100000000 = 1000000000000
      expect(feeDetails).toEqual({
        baseFee: BigInt('1000000000000000'),
        percentageFee: BigInt('1000000000000'), // 0.001% of 1 USDC
        totalRequiredFee: BigInt('1001001000000000000'), // route value + base + percentage
        currentReward: BigInt('5000000000000000000'), // 5 USDC normalized
        minimumRequiredReward: BigInt('1001001000000000000'),
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
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      expect(feeDetails).toEqual({
        baseFee: BigInt('0'),
        percentageFee: BigInt('50000000000'), // 0.00005% of 1 token (0.005 bps)
        totalRequiredFee: BigInt('1000000050000000000'), // route value + percentage
        currentReward: BigInt('5000000000000000000'), // 5 USDC normalized
        minimumRequiredReward: BigInt('1000000050000000000'),
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
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      expect(feeDetails).toEqual({
        baseFee: BigInt('2000000000000000'),
        percentageFee: BigInt('0'),
        totalRequiredFee: BigInt('1002000000000000000'), // route value + base fee
        currentReward: BigInt('5000000000000000000'), // 5 USDC normalized
        minimumRequiredReward: BigInt('1002000000000000000'),
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
      });

      // Calculate fee details
      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Reset mocks to ensure validate uses fresh calls
      jest.clearAllMocks();
      blockchainConfigService.getFeeLogic.mockReturnValue({
        tokens: {
          flatFee: 0.0015,
          scalarBps: 0.0005,
        },
      });

      // Validate should pass because currentReward >= totalRequiredFee
      const isValid = await validation.validate(intent, mockContext);

      expect(isValid).toBe(true);
      expect(feeDetails.currentReward).toBe(BigInt('2000000000000000000'));
      expect(feeDetails.totalRequiredFee).toBe(BigInt('1001500050000000000')); // route value + fees
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
      });

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
      });

      await expect(validation.validate(intent, mockContext)).rejects.toThrow(
        'Reward amount 500000000000000 is less than required fee 1001100000000000000 (base: 1000000000000000, scalar: 100000000000000)',
      );
    });
  });
});
