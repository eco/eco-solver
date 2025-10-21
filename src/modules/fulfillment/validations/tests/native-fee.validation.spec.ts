import { Test } from '@nestjs/testing';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { FeeResolverService } from '@/modules/config/services/fee-resolver.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { NativeFeeValidation } from '../native-fee.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

// Helper function to create UniversalAddress from string
function toUniversalAddress(address: string): UniversalAddress {
  return address as UniversalAddress;
}

describe('NativeFeeValidation', () => {
  let validation: NativeFeeValidation;
  let feeResolverService: jest.Mocked<FeeResolverService>;

  beforeEach(async () => {
    const mockFeeResolverService = {
      resolveNativeFee: jest.fn().mockReturnValue({
        native: {
          flatFee: 20000000000000000, // 0.02 ETH
          scalarBps: 1.5, // 150 bps = 1.5%
        },
        tokens: {
          flatFee: 10000000000000000, // 0.01 ETH
          scalarBps: 1, // 100 bps = 1%
        },
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
        NativeFeeValidation,
        {
          provide: FeeResolverService,
          useValue: mockFeeResolverService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<NativeFeeValidation>(NativeFeeValidation);
    feeResolverService = module.get(FeeResolverService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    describe('reward token validation', () => {
      it('should throw error when reward tokens are present', async () => {
        // Default mockIntent has reward tokens, which should fail native fee validation
        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Native fee validation only applies to intents with pure native rewards, but reward tokens are present',
        );
      });

      it('should pass when no reward tokens are present and route is valid', async () => {
        const pureNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(30000000000000000), // 0.03 ETH
            tokens: [], // No reward tokens
          },
          route: {
            ...mockIntent.route,
            calls: [], // No calls means route.native = 0
          },
        });

        const result = await validation.validate(pureNativeIntent, mockContext);
        expect(result).toBe(true);
      });

      it('should throw error even with single reward token', async () => {
        const intentWithOneToken = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(100000000000000000), // 0.1 ETH
            tokens: [
              {
                token:
                  '0x0000000000000000000000001111111111111111111111111111111111111111' as UniversalAddress,
                amount: BigInt(1000),
              },
            ],
          },
        });

        await expect(validation.validate(intentWithOneToken, mockContext)).rejects.toThrow(
          'Native fee validation only applies to intents with pure native rewards, but reward tokens are present',
        );
      });
    });

    describe('route validation', () => {
      it('should pass when route.native is less than maximum', async () => {
        // Reward: 100 ETH, Fee: 0.02 ETH base + 1.5% of 100 ETH = 0.02 + 1.5 = 1.52 ETH
        // Maximum native = 100 - 1.52 = 98.48 ETH
        // Route native = 50 ETH (less than maximum)
        const pureNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('100000000000000000000'), // 100 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('50000000000000000000'), // 50 ETH
              },
            ],
          },
        });

        const result = await validation.validate(pureNativeIntent, mockContext);
        expect(result).toBe(true);
      });

      it('should pass when route.native equals maximum', async () => {
        // Reward: 1 ETH
        // Fee: 0.02 ETH base + 1.5% of 1 ETH = 0.02 + 0.015 = 0.035 ETH
        // Maximum native = 1 - 0.035 = 0.965 ETH
        feeResolverService.resolveNativeFee.mockReturnValue({
          native: {
            flatFee: 20000000000000000, // 0.02 ETH
            scalarBps: 1.5, // 150 bps = 1.5%
          },
          tokens: {
            flatFee: 10000000000000000,
            scalarBps: 1,
          },
        });

        const pureNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('1000000000000000000'), // 1 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('965000000000000000'), // 0.965 ETH (exactly maximum)
              },
            ],
          },
        });

        const result = await validation.validate(pureNativeIntent, mockContext);
        expect(result).toBe(true);
      });

      it('should throw error when route.native exceeds maximum', async () => {
        // Reward: 1 ETH
        // Fee: 0.02 ETH base + 1.5% of 1 ETH = 0.02 + 0.015 = 0.035 ETH
        // Maximum native = 1 - 0.035 = 0.965 ETH
        // Route native = 2 ETH (exceeds maximum)
        const pureNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('1000000000000000000'), // 1 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('2000000000000000000'), // 2 ETH
              },
            ],
          },
        });

        await expect(validation.validate(pureNativeIntent, mockContext)).rejects.toThrow(
          /Native route .* exceeds the maximum amount/,
        );
      });

      it('should handle multiple native calls', async () => {
        // Reward: 10 ETH
        // Fee: 0.02 ETH base + 1.5% of 10 ETH = 0.02 + 0.15 = 0.17 ETH
        // Maximum native = 10 - 0.17 = 9.83 ETH
        // Total route native = 0.5 + 0.8 + 0.7 = 2 ETH (less than maximum)
        const multiNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('10000000000000000000'), // 10 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('500000000000000000'), // 0.5 ETH
              },
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000002222222222222222222222222222222222222222',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('800000000000000000'), // 0.8 ETH
              },
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('700000000000000000'), // 0.7 ETH
              },
            ],
          },
        });

        const result = await validation.validate(multiNativeIntent, mockContext);
        expect(result).toBe(true);
      });

      it('should pass when route has no calls (zero native)', async () => {
        const intentWithNoCalls = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('1000000000000000000'), // 1 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [], // No calls means route.native = 0
          },
        });

        const result = await validation.validate(intentWithNoCalls, mockContext);
        expect(result).toBe(true);
      });
    });

    describe('fee configurations', () => {
      it('should handle zero base fee', async () => {
        feeResolverService.resolveNativeFee.mockReturnValue({
          native: {
            flatFee: 0,
            scalarBps: 3, // 300 bps = 3%
          },
          tokens: {
            flatFee: 10000000000000000,
            scalarBps: 1,
          },
        });

        // Reward: 1 ETH, Fee: 0 + 3% = 0.03 ETH, Maximum = 0.97 ETH
        // Route: 0.5 ETH (less than maximum)
        const intentWithZeroBase = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('1000000000000000000'), // 1 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('500000000000000000'), // 0.5 ETH
              },
            ],
          },
        });

        const result = await validation.validate(intentWithZeroBase, mockContext);
        expect(result).toBe(true);
      });

      it('should handle zero percentage fee', async () => {
        feeResolverService.resolveNativeFee.mockReturnValue({
          native: {
            flatFee: 100000000000000000, // 0.1 ETH
            scalarBps: 0,
          },
          tokens: {
            flatFee: 10000000000000000,
            scalarBps: 1,
          },
        });

        // Reward: 1 ETH, Fee: 0.1 + 0% = 0.1 ETH, Maximum = 0.9 ETH
        // Route: 0.5 ETH (less than maximum)
        const intentWithZeroPercentage = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('1000000000000000000'), // 1 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('500000000000000000'), // 0.5 ETH
              },
            ],
          },
        });

        const result = await validation.validate(intentWithZeroPercentage, mockContext);
        expect(result).toBe(true);
      });

      it('should handle high percentage fees', async () => {
        feeResolverService.resolveNativeFee.mockReturnValue({
          native: {
            flatFee: 0,
            scalarBps: 10, // 1000 bps = 10%
          },
          tokens: {
            flatFee: 10000000000000000,
            scalarBps: 1,
          },
        });

        // Reward: 10 ETH, Fee: 0 + 10% of 10 = 1 ETH, Maximum = 9 ETH
        // Route: 5 ETH (less than maximum)
        const highFeeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('10000000000000000000'), // 10 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('5000000000000000000'), // 5 ETH
              },
            ],
          },
        });

        const result = await validation.validate(highFeeIntent, mockContext);
        expect(result).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle very small values with precision', async () => {
        feeResolverService.resolveNativeFee.mockReturnValue({
          native: {
            flatFee: 1000000000000, // 0.000001 ETH
            scalarBps: 0.1, // 10 bps = 0.1%
          },
          tokens: {
            flatFee: 10000000000000000,
            scalarBps: 1,
          },
        });

        // Reward: 0.01 ETH, Fee: 0.000001 + 0.1% of 0.01 = 0.000001 + 0.00001 = 0.000011 ETH
        // Maximum = 0.01 - 0.000011 = 0.009989 ETH
        // Route: 0.001 ETH (less than maximum)
        const smallIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('10000000000000000'), // 0.01 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('1000000000000000'), // 0.001 ETH
              },
            ],
          },
        });

        const result = await validation.validate(smallIntent, mockContext);
        expect(result).toBe(true);
      });

      it('should handle percentage calculation with odd numbers', async () => {
        feeResolverService.resolveNativeFee.mockReturnValue({
          native: {
            flatFee: 0,
            scalarBps: 3.33, // 333 bps = 3.33%
          },
          tokens: {
            flatFee: 10000000000000000,
            scalarBps: 1,
          },
        });

        // Reward: 10 ETH, Fee: 0 + 3.33% of 10 = 0.333 ETH
        // Maximum = 10 - 0.333 = 9.667 ETH
        // Route: 5 ETH (less than maximum)
        const oddIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('10000000000000000000'), // 10 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt('5000000000000000000'), // 5 ETH
              },
            ],
          },
        });

        const result = await validation.validate(oddIntent, mockContext);
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
          nativeAmount: BigInt('5000000000000000000'), // 5 ETH reward
          tokens: [],
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
              data: '0x' as `0x${string}`,
              value: BigInt('2000000000000000000'), // 2 ETH native value
            },
          ],
        },
      });

      feeResolverService.resolveNativeFee.mockReturnValue({
        native: {
          flatFee: 10000000000000000, // 0.01 ETH base fee
          scalarBps: 50, // 50 bps = 0.5%
        },
        tokens: {
          flatFee: 10000000000000000,
          scalarBps: 1,
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Base fee: 0.01 ETH
      // Percentage fee: 0.5% of 5 ETH reward = 0.025 ETH
      // Total fee: 0.035 ETH
      // Maximum native: 5 - 0.035 = 4.965 ETH
      expect(feeDetails).toEqual({
        reward: {
          native: BigInt('5000000000000000000'),
          tokens: BigInt('0'),
        },
        route: {
          native: BigInt('2000000000000000000'),
          tokens: BigInt('0'),
          maximum: {
            native: BigInt('4965000000000000000'),
            tokens: BigInt('0'),
          },
        },
        fee: {
          base: BigInt('10000000000000000'),
          percentage: BigInt('25000000000000000'),
          total: BigInt('35000000000000000'),
          bps: 50,
        },
      });
    });

    it('should handle multiple calls with native values', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeAmount: BigInt('10000000000000000000'), // 10 ETH reward
          tokens: [],
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: toUniversalAddress(
                '0x0000000000000000000000001111111111111111111111111111111111111111',
              ),
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH
            },
            {
              target: toUniversalAddress(
                '0x0000000000000000000000002222222222222222222222222222222222222222',
              ),
              data: '0x' as `0x${string}`,
              value: BigInt('2000000000000000000'), // 2 ETH
            },
            {
              target: toUniversalAddress(
                '0x0000000000000000000000003333333333333333333333333333333333333333',
              ),
              data: '0x' as `0x${string}`,
              value: BigInt('500000000000000000'), // 0.5 ETH
            },
          ],
        },
      });

      feeResolverService.resolveNativeFee.mockReturnValue({
        native: {
          flatFee: 20000000000000000, // 0.02 ETH
          scalarBps: 200, // 200 bps = 2%
        },
        tokens: {
          flatFee: 10000000000000000,
          scalarBps: 1,
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Total route native value = 3.5 ETH
      // Base fee: 0.02 ETH
      // Percentage fee: 2% of 10 ETH reward = 0.2 ETH
      // Total fee: 0.22 ETH
      // Maximum native: 10 - 0.22 = 9.78 ETH
      expect(feeDetails).toEqual({
        reward: {
          native: BigInt('10000000000000000000'),
          tokens: BigInt('0'),
        },
        route: {
          native: BigInt('3500000000000000000'),
          tokens: BigInt('0'),
          maximum: {
            native: BigInt('9780000000000000000'),
            tokens: BigInt('0'),
          },
        },
        fee: {
          base: BigInt('20000000000000000'),
          percentage: BigInt('200000000000000000'),
          total: BigInt('220000000000000000'),
          bps: 200,
        },
      });
    });

    it('should handle zero native value in calls', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeAmount: BigInt('1000000000000000000'),
          tokens: [],
        },
        route: {
          ...mockIntent.route,
          calls: [], // No calls with native value
        },
      });

      feeResolverService.resolveNativeFee.mockReturnValue({
        native: {
          flatFee: 5000000000000000, // 0.005 ETH
          scalarBps: 100, // 100 bps = 1%
        },
        tokens: {
          flatFee: 10000000000000000,
          scalarBps: 1,
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Base fee: 0.005 ETH
      // Percentage fee: 1% of 1 ETH reward = 0.01 ETH
      // Total fee: 0.015 ETH
      // Maximum native: 1 - 0.015 = 0.985 ETH
      expect(feeDetails).toEqual({
        reward: {
          native: BigInt('1000000000000000000'),
          tokens: BigInt('0'),
        },
        route: {
          native: BigInt('0'),
          tokens: BigInt('0'),
          maximum: {
            native: BigInt('985000000000000000'),
            tokens: BigInt('0'),
          },
        },
        fee: {
          base: BigInt('5000000000000000'),
          percentage: BigInt('10000000000000000'),
          total: BigInt('15000000000000000'),
          bps: 100,
        },
      });
    });

    it('should handle undefined fee config values', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeAmount: BigInt('1000000000000000000'),
          tokens: [],
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
              data: '0x' as `0x${string}`,
              value: BigInt('500000000000000000'),
            },
          ],
        },
      });

      feeResolverService.resolveNativeFee.mockReturnValue({
        native: {
          flatFee: 0,
          scalarBps: 0,
        },
        tokens: {
          flatFee: 10000000000000000,
          scalarBps: 1,
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Base fee: 0, Percentage fee: 0, Total fee: 0
      // Maximum native: 1 ETH
      expect(feeDetails).toEqual({
        reward: {
          native: BigInt('1000000000000000000'),
          tokens: BigInt('0'),
        },
        route: {
          native: BigInt('500000000000000000'),
          tokens: BigInt('0'),
          maximum: {
            native: BigInt('1000000000000000000'),
            tokens: BigInt('0'),
          },
        },
        fee: {
          base: BigInt('0'),
          percentage: BigInt('0'),
          total: BigInt('0'),
          bps: 0,
        },
      });
    });

    it('should handle high precision scalar calculations', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeAmount: BigInt('1234567890123456789'), // ~1.234 ETH
          tokens: [],
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: toUniversalAddress(
                '0x0000000000000000000000001234567890123456789012345678901234567890',
              ),
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH
            },
          ],
        },
      });

      feeResolverService.resolveNativeFee.mockReturnValue({
        native: {
          flatFee: 0,
          scalarBps: 25, // 25 bps = 0.25%
        },
        tokens: {
          flatFee: 10000000000000000,
          scalarBps: 1,
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Percentage fee: 0.25% of 1234567890123456789 = 3086419725308641
      expect(feeDetails.fee.percentage).toBe(BigInt('3086419725308641'));
      expect(feeDetails.fee.base).toBe(BigInt('0'));
      expect(feeDetails.fee.total).toBe(BigInt('3086419725308641'));
    });
  });
});
