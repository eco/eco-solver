import { Test } from '@nestjs/testing';

// BigInt toJSON polyfill moved to jest.setup.ts
import { FeeResolverService } from '@/modules/config/services/fee-resolver.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { NativeFeeValidation } from '../native-fee.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('NativeFeeValidation', () => {
  let validation: NativeFeeValidation;

  beforeEach(async () => {
    const mockFeeResolver = {
      resolveNativeFee: jest.fn().mockReturnValue({
        flatFee: 20000000000000000, // 0.02 ETH
        scalarBps: 1.5, // 150 bps = 1.5%
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
        { provide: FeeResolverService, useValue: mockFeeResolver },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<NativeFeeValidation>(NativeFeeValidation);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    // Default native fees via resolver mock: 0.02 ETH base + 150 bps (1.5%)

    describe('reward token validation', () => {
      it('should throw error when reward tokens are present', async () => {
        // Default mockIntent has reward tokens, which should fail native fee validation
        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Native fee validation only applies to intents with pure native rewards, but reward tokens are present',
        );
      });

      it('should pass when no reward tokens are present', async () => {
        const pureNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(30000000000000000), // 0.03 ETH to cover base fee
            tokens: [], // No reward tokens
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
                token: '0x0000000000000000000000001111111111111111111111111111111111111111' as any,
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

    describe('fee calculation', () => {
      it('should pass when reward covers base fee plus percentage fee', async () => {
        const pureNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(30000000000000000), // 0.03 ETH
            tokens: [], // No reward tokens - required for native fee validation
          },
        });

        // Note: NativeFeeValidation only looks at call values, not tokens
        // Default mockIntent has no calls with value, so nativeAmount = 0
        // Base fee: 0.02 ETH
        // Percentage fee: 1.5% of 0 = 0
        // Total fee: 0.02 ETH
        // Intent has nativeAmount of 0.03 ETH, so it passes

        const result = await validation.validate(pureNativeIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should validate when route native is within reward minus fees', async () => {
        const intentWithMultipleValues = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(40000000000000000), // 0.04 ETH reward
            tokens: [], // No reward tokens
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x0000000000000000000000001111111111111111111111111111111111111111' as any,
                amount: BigInt(300000000000000000),
              }, // 0.3 ETH - NOT included in fee calculation
              {
                token: '0x0000000000000000000000002222222222222222222222222222222222222222' as any,
                amount: BigInt(200000000000000000),
              }, // 0.2 ETH - NOT included in fee calculation
            ],
            calls: [
              {
                target: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(10000000000000000), // 0.01 ETH
              },
            ],
          },
        });

        // Route native: 0.01 ETH
        // Base fee: 0.02 ETH
        // Percentage fee (on reward): 1.5% of 0.04 ETH = 0.0006 ETH
        // Total fee: 0.0206 ETH
        // Maximum route native: 0.04 - 0.0206 = 0.0194 ETH (route 0.01 passes)

        const result = await validation.validate(intentWithMultipleValues, mockContext);

        expect(result).toBe(true);
      });

      it('should handle native intents fee structure correctly', async () => {
        const feeResolver = (await (
          await Test.createTestingModule({
            providers: [
              {
                provide: FeeResolverService,
                useValue: {
                  resolveNativeFee: jest
                    .fn()
                    .mockReturnValue({ flatFee: 50000000000000000, scalarBps: 2.5 }),
                },
              },
            ],
          }).compile()
        ).get(FeeResolverService)) as any;
        (validation as any).feeResolverService = feeResolver;

        const nativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('2300000000000000000'), // 2.3 ETH reward
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [
              {
                target: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(2000000000000000000), // 2 ETH native transfer
              },
            ],
          },
        });

        // Base fee: 0.05 ETH; Percentage fee (on reward 2.3 ETH): 0.0575 ETH
        // Total fee: 0.1075 ETH; Maximum: 2.1925 ETH >= route 2 ETH

        const result = await validation.validate(nativeIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('fee validation failures', () => {
      it('should throw error when reward is less than total fee', async () => {
        const lowRewardIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(10000000000000000), // 0.01 ETH
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(1000000000000000000), // 1 ETH
              },
            ],
          },
        });

        // Native value from calls: 1 ETH
        // Base fee: 0.02 ETH
        // Percentage fee: 1.5% of 1 ETH = 0.00015 ETH (calculation uses base 1000)
        // Total fee: 0.02015 ETH
        // Reward (0.01 ETH) < Total fee (0.02015 ETH)

        await expect(validation.validate(lowRewardIntent, mockContext)).rejects.toThrow(
          'exceeds the maximum amount',
        );
      });

      it('should throw error for insufficient reward with precise calculation', async () => {
        const preciseIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('20149999999999999'), // 1 wei less than required
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(1000000000000000000), // 1 ETH
              },
            ],
          },
        });

        await expect(validation.validate(preciseIntent, mockContext)).rejects.toThrow(
          'exceeds the maximum amount',
        );
      });
    });

    describe('different fee configurations', () => {
      it('should handle zero base fee', async () => {
        const feeResolver = (await (
          await Test.createTestingModule({
            providers: [
              {
                provide: FeeResolverService,
                useValue: {
                  resolveNativeFee: jest.fn().mockReturnValue({ flatFee: 0, scalarBps: 3 }),
                },
              },
            ],
          }).compile()
        ).get(FeeResolverService)) as any;
        (validation as any).feeResolverService = feeResolver;

        const intentWithZeroBase = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(30000000000000000), // 0.03 ETH (exactly 3% of 1 ETH)
            tokens: [],
          },
        });

        const result = await validation.validate(intentWithZeroBase, mockContext);

        expect(result).toBe(true);
      });

      it('should handle zero percentage fee', async () => {
        (validation as any).feeResolverService = {
          resolveNativeFee: () => ({ flatFee: 100000000000000000, scalarBps: 0 }),
        } as unknown as FeeResolverService;

        const intentWithZeroPercentage = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(100000000000000000), // 0.1 ETH (exactly base fee)
            tokens: [],
          },
        });

        const result = await validation.validate(intentWithZeroPercentage, mockContext);

        expect(result).toBe(true);
      });

      it('should handle high percentage fees for native intents', async () => {
        const feeResolver = (await (
          await Test.createTestingModule({
            providers: [
              {
                provide: FeeResolverService,
                useValue: {
                  resolveNativeFee: jest.fn().mockReturnValue({ flatFee: 0, scalarBps: 10 }),
                },
              },
            ],
          }).compile()
        ).get(FeeResolverService)) as any;
        (validation as any).feeResolverService = feeResolver;

        const highFeeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(150000000000000000), // 0.15 ETH
            tokens: [],
          },
        });

        // Total value: 1 ETH
        // Percentage fee: 10% of 1 ETH = 0.1 ETH
        // Reward (0.15 ETH) > Fee (0.1 ETH)

        const result = await validation.validate(highFeeIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('native intent specific scenarios', () => {
      it('should validate pure native token transfers', async () => {
        const pureNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(50000000000000000), // 0.05 ETH reward
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            tokens: [], // No tokens
            calls: [
              {
                target: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(29000000000000000), // 0.029 ETH pure native transfer
              },
            ],
          },
        });

        // Route: 0.03 ETH; Base: 0.02 ETH; Percentage on reward 0.05 ETH = 0.00075 ETH
        // Total fee: 0.02075 ETH; Maximum: ~0.02925 ETH; Route 0.03 ETH <= Maximum

        const result = await validation.validate(pureNativeIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle multiple native calls', async () => {
        const multiNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(100000000000000000), // 0.1 ETH reward
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [
              {
                target: '0x0000000000000000000000001111111111111111111111111111111111111111' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(20000000000000000), // 0.02 ETH
              },
              {
                target: '0x0000000000000000000000002222222222222222222222222222222222222222' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(30000000000000000), // 0.03 ETH
              },
              {
                target: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(20000000000000000), // 0.02 ETH
              },
            ],
          },
        });

        // Route = 0.07 ETH; Base 0.02; Percentage on reward 0.1 = 0.0015; Total fee 0.0215
        // Maximum ~0.0785 ETH; Route 0.07 ETH <= Maximum

        const result = await validation.validate(multiNativeIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle very small values with precision', async () => {
        const feeResolver = (await (
          await Test.createTestingModule({
            providers: [
              {
                provide: FeeResolverService,
                useValue: {
                  resolveNativeFee: jest
                    .fn()
                    .mockReturnValue({ flatFee: 1000000000000, scalarBps: 0.1 }),
                },
              },
            ],
          }).compile()
        ).get(FeeResolverService)) as any;
        (validation as any).feeResolverService = feeResolver;

        const smallIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt(2000000000001), // Slightly above required fee
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [
              {
                target: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(100000000000), // 0.0000001 ETH
              },
            ],
          },
        });

        // Native value: 0.001 ETH
        // Base fee: 0.000001 ETH
        // Percentage fee: 0.1% of 0.001 ETH = 0.000001 ETH
        // Total fee: 0.000002 ETH = 2000000000000
        // Reward: 2000000000001 > 2000000000000

        const result = await validation.validate(smallIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle percentage calculation with odd numbers', async () => {
        const feeResolver = (await (
          await Test.createTestingModule({
            providers: [
              {
                provide: FeeResolverService,
                useValue: {
                  resolveNativeFee: jest.fn().mockReturnValue({ flatFee: 0, scalarBps: 3.33 }),
                },
              },
            ],
          }).compile()
        ).get(FeeResolverService)) as any;
        (validation as any).feeResolverService = feeResolver;

        const oddIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeAmount: BigInt('33300000000000001'), // Covers fee with odd percentage
            tokens: [],
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [
              {
                target: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
                data: '0x' as `0x${string}`,
                value: BigInt(30000000000000000), // 0.03 ETH
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
              target: '0x0000000000000000000000001234567890123456789012345678901234567890' as any,
              data: '0x' as `0x${string}`,
              value: BigInt('2000000000000000000'), // 2 ETH native value
            },
          ],
        },
      });

      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 10000000000000000, scalarBps: 50 }),
      } as unknown as FeeResolverService;

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      expect(feeDetails).toEqual({
        reward: { native: BigInt('5000000000000000000'), tokens: 0n },
        route: {
          native: BigInt('2000000000000000000'),
          tokens: 0n,
          maximum: { native: BigInt('4965000000000000000'), tokens: 0n },
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
              target: '0x0000000000000000000000001111111111111111111111111111111111111111' as any,
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH
            },
            {
              target: '0x0000000000000000000000002222222222222222222222222222222222222222' as any,
              data: '0x' as `0x${string}`,
              value: BigInt('2000000000000000000'), // 2 ETH
            },
            {
              target: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
              data: '0x' as `0x${string}`,
              value: BigInt('500000000000000000'), // 0.5 ETH
            },
          ],
        },
      });

      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 20000000000000000, scalarBps: 200 }),
      } as unknown as FeeResolverService;

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Total native value = 3.5 ETH
      // Percentage fee = 3.5 ETH * 2% = 0.07 ETH
      expect(feeDetails).toEqual({
        reward: { native: BigInt('10000000000000000000'), tokens: 0n },
        route: {
          native: BigInt('3500000000000000000'),
          tokens: 0n,
          maximum: { native: BigInt('9780000000000000000'), tokens: 0n },
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

      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 5000000000000000, scalarBps: 100 }),
      } as unknown as FeeResolverService;

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      expect(feeDetails).toEqual({
        reward: { native: BigInt('1000000000000000000'), tokens: 0n },
        route: {
          native: 0n,
          tokens: 0n,
          maximum: { native: BigInt('985000000000000000'), tokens: 0n },
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
              target: '0x0000000000000000000000001234567890123456789012345678901234567890' as any,
              data: '0x' as `0x${string}`,
              value: BigInt('500000000000000000'),
            },
          ],
        },
      });

      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 0, scalarBps: 0 }),
      } as unknown as FeeResolverService;

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      expect(feeDetails).toBeDefined();
      expect(feeDetails.fee.base).toBe(BigInt('0'));
      expect(feeDetails.fee.percentage).toBe(BigInt('0'));
      expect(feeDetails.fee.total).toBe(BigInt('0'));
    });

    it('should handle high precision scalar calculations', async () => {
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
              target: '0x0000000000000000000000001234567890123456789012345678901234567890' as any,
              data: '0x' as `0x${string}`,
              value: BigInt('1234567890123456789'), // ~1.234 ETH
            },
          ],
        },
      });

      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 0, scalarBps: 25 }),
      } as unknown as FeeResolverService;

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Percentage on reward (1 ETH): 25 bps -> 0.25% = 0.0025 ETH
      expect(feeDetails.fee.percentage).toBe(BigInt('2500000000000000'));
    });
  });

  describe('validate and calculateFee consistency', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    it('should use the same calculation logic', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeAmount: BigInt('50000000000000000'), // 0.05 ETH reward
          tokens: [],
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x0000000000000000000000001234567890123456789012345678901234567890' as any,
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH native value
            },
          ],
        },
      });

      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 10000000000000000, scalarBps: 20 }),
      } as unknown as FeeResolverService;

      // Calculate fee details
      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Reset mock
      jest.clearAllMocks();
      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 30000000000000000, scalarBps: 20 }),
      } as unknown as FeeResolverService;

      await expect(validation.validate(intent, mockContext)).rejects.toThrow(
        'exceeds the maximum amount',
      );
      expect(feeDetails.reward.native).toBe(BigInt('50000000000000000'));
      expect(feeDetails.fee.total).toBe(BigInt('10100000000000000')); // base + percentage (0.01 + 0.0001)
    });

    it('should pass validation when reward covers the native fee using calculateFee', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeAmount: BigInt('2000000000000000000'), // 2 ETH reward
          tokens: [],
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x0000000000000000000000001234567890123456789012345678901234567890' as any,
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH native value in call
            },
          ],
        },
      });

      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 1000000000000000, scalarBps: 100 }),
      } as unknown as FeeResolverService;

      const result = await validation.validate(intent, mockContext);

      expect(result).toBe(true);
    });

    it('should throw error when reward does not cover the native fee using calculateFee', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeAmount: BigInt('5000000000000000'), // 0.005 ETH reward (too low)
          tokens: [],
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x0000000000000000000000001234567890123456789012345678901234567890' as any,
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH native value
            },
          ],
        },
      });

      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 1000000000000000, scalarBps: 100 }),
      } as unknown as FeeResolverService;
      (validation as any).feeResolverService = {
        resolveNativeFee: () => ({ flatFee: 10000000000000000, scalarBps: 100 }),
      } as unknown as FeeResolverService;

      await expect(validation.validate(intent, mockContext)).rejects.toThrow(
        'exceeds the maximum amount',
      );
    });
  });
});
