import { Test } from '@nestjs/testing';

import { Address } from 'viem';

import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

// Mock the config service module before any imports
jest.mock('@/modules/config/services/fulfillment-config.service', () => ({
  FulfillmentConfigService: jest.fn().mockImplementation(() => {
    let nativeFeeValue = { baseFee: BigInt(0), bpsFee: 0 };
    return {
      get nativeFee() {
        return nativeFeeValue;
      },
      set nativeFee(value) {
        nativeFeeValue = value;
      },
    };
  }),
}));

import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { NativeFeeValidation } from '../native-fee.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('NativeFeeValidation', () => {
  let validation: NativeFeeValidation;
  let fulfillmentConfigService: jest.Mocked<FulfillmentConfigService>;

  beforeEach(async () => {
    const mockFulfillmentConfigService = {
      get nativeFee() {
        return this._nativeFee;
      },
      _nativeFee: { baseFee: BigInt(20000000000000000), bpsFee: 150 },
      getNetworkFee: jest.fn().mockReturnValue({
        native: {
          flatFee: BigInt(20000000000000000), // 0.02 ETH
          scalarBps: 1.5, // 150 bps = 1.5%
        },
        tokens: {
          flatFee: BigInt(10000000000000000), // 0.01 ETH
          scalarBps: 1, // 100 bps = 1%
        },
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
        NativeFeeValidation,
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

    validation = module.get<NativeFeeValidation>(NativeFeeValidation);
    fulfillmentConfigService = module.get(FulfillmentConfigService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    // Default native fees are already set in mock: 0.02 ETH base + 150 bps (1.5%)

    describe('fee calculation', () => {
      it('should pass when reward covers base fee plus percentage fee', async () => {
        // Note: NativeFeeValidation only looks at call values, not tokens
        // Default mockIntent has no calls, so nativeValue = 0
        // Base fee: 0.02 ETH
        // Percentage fee: 1.5% of 0 = 0
        // Total fee: 0.02 ETH
        // But mockIntent has nativeValue of 1 ETH, so it passes

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should calculate percentage fee from call values only', async () => {
        const intentWithMultipleValues = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(40000000000000000), // 0.04 ETH reward
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(300000000000000000),
              }, // 0.3 ETH - NOT included in fee calculation
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(200000000000000000),
              }, // 0.2 ETH - NOT included in fee calculation
            ],
            calls: [
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(500000000000000000), // 0.5 ETH - ONLY this is included
              },
            ],
          },
        });

        // Native value from calls: 0.5 ETH (tokens are ignored)
        // Base fee: 0.02 ETH
        // Percentage fee: 1.5% of 0.5 ETH = 0.0075 ETH
        // Total fee: 0.0275 ETH
        // Reward (0.04 ETH) > Total fee (0.0275 ETH)

        const result = await validation.validate(intentWithMultipleValues, mockContext);

        expect(result).toBe(true);
      });

      it('should handle native intents fee structure correctly', async () => {
        (fulfillmentConfigService as any)._nativeFee = {
          baseFee: BigInt(50000000000000000), // 0.05 ETH - higher for native intents
          bpsFee: 250, // 250 bps = 2.5% - higher percentage for native intents
        };
        (fulfillmentConfigService as any).getNetworkFee.mockReturnValue({
          native: {
            flatFee: BigInt(50000000000000000), // 0.05 ETH
            scalarBps: 2.5, // 250 bps = 2.5%
          },
          tokens: {
            flatFee: BigInt(10000000000000000),
            scalarBps: 1,
          },
        });

        const nativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(100000000000000000), // 0.1 ETH reward
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(2000000000000000000), // 2 ETH native transfer
              },
            ],
          },
        });

        // Total value: 2 ETH (native transfer)
        // Base fee: 0.05 ETH
        // Percentage fee: 2.5% of 2 ETH = 0.05 ETH
        // Total fee: 0.1 ETH
        // Reward (0.1 ETH) = Total fee (0.1 ETH)

        const result = await validation.validate(nativeIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('fee validation failures', () => {
      it('should throw error when reward is less than total fee', async () => {
        const lowRewardIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(10000000000000000), // 0.01 ETH
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
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
          'Reward 10000000000000000 is less than required native fee 20150000000000000 (base: 20000000000000000, percentage: 150000000000000)',
        );
      });

      it('should throw error for insufficient reward with precise calculation', async () => {
        const preciseIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt('20149999999999999'), // 1 wei less than required
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(1000000000000000000), // 1 ETH
              },
            ],
          },
        });

        await expect(validation.validate(preciseIntent, mockContext)).rejects.toThrow(
          'Reward 20149999999999999 is less than required native fee 20150000000000000 (base: 20000000000000000, percentage: 150000000000000)',
        );
      });
    });

    describe('different fee configurations', () => {
      it('should handle zero base fee', async () => {
        (fulfillmentConfigService as any)._nativeFee = {
          baseFee: BigInt(0),
          bpsFee: 300, // 300 bps = 3%
        };
        (fulfillmentConfigService as any).getNetworkFee.mockReturnValue({
          native: {
            flatFee: BigInt(0),
            scalarBps: 3, // 300 bps = 3%
          },
          tokens: {
            flatFee: BigInt(10000000000000000),
            scalarBps: 1,
          },
        });

        const intentWithZeroBase = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(30000000000000000), // 0.03 ETH (exactly 3% of 1 ETH)
          },
        });

        const result = await validation.validate(intentWithZeroBase, mockContext);

        expect(result).toBe(true);
      });

      it('should handle zero percentage fee', async () => {
        (fulfillmentConfigService as any)._nativeFee = {
          baseFee: BigInt(100000000000000000), // 0.1 ETH
          bpsFee: 0,
        };
        (fulfillmentConfigService as any).getNetworkFee.mockReturnValue({
          native: {
            flatFee: BigInt(100000000000000000), // 0.1 ETH
            scalarBps: 0,
          },
          tokens: {
            flatFee: BigInt(10000000000000000),
            scalarBps: 1,
          },
        });

        const intentWithZeroPercentage = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(100000000000000000), // 0.1 ETH (exactly base fee)
          },
        });

        const result = await validation.validate(intentWithZeroPercentage, mockContext);

        expect(result).toBe(true);
      });

      it('should handle high percentage fees for native intents', async () => {
        (fulfillmentConfigService as any)._nativeFee = {
          baseFee: BigInt(0),
          bpsFee: 1000, // 1000 bps = 10% - potentially higher for native intents
        };
        (fulfillmentConfigService as any).getNetworkFee.mockReturnValue({
          native: {
            flatFee: BigInt(0),
            scalarBps: 10, // 1000 bps = 10%
          },
          tokens: {
            flatFee: BigInt(10000000000000000),
            scalarBps: 1,
          },
        });

        const highFeeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(150000000000000000), // 0.15 ETH
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
            nativeValue: BigInt(50000000000000000), // 0.05 ETH reward
          },
          route: {
            ...mockIntent.route,
            tokens: [], // No tokens
            calls: [
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(1000000000000000000), // 1 ETH pure native transfer
              },
            ],
          },
        });

        // Total value: 1 ETH
        // Base fee: 0.02 ETH
        // Percentage fee: 1.5% of 1 ETH = 0.015 ETH
        // Total fee: 0.035 ETH
        // Reward (0.05 ETH) > Total fee (0.035 ETH)

        const result = await validation.validate(pureNativeIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle multiple native calls', async () => {
        const multiNativeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(100000000000000000), // 0.1 ETH reward
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [
              {
                target: '0x1111111111111111111111111111111111111111' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(500000000000000000), // 0.5 ETH
              },
              {
                target: '0x2222222222222222222222222222222222222222' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(800000000000000000), // 0.8 ETH
              },
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(700000000000000000), // 0.7 ETH
              },
            ],
          },
        });

        // Total value: 0.5 + 0.8 + 0.7 = 2 ETH
        // Base fee: 0.02 ETH
        // Percentage fee: 1.5% of 2 ETH = 0.03 ETH
        // Total fee: 0.05 ETH
        // Reward (0.1 ETH) > Total fee (0.05 ETH)

        const result = await validation.validate(multiNativeIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle very small values with precision', async () => {
        (fulfillmentConfigService as any)._nativeFee = {
          baseFee: BigInt(1000000000000), // 0.000001 ETH
          bpsFee: 10, // 10 bps = 0.1%
        };
        (fulfillmentConfigService as any).getNetworkFee.mockReturnValue({
          native: {
            flatFee: BigInt(1000000000000), // 0.000001 ETH
            scalarBps: 0.1, // 10 bps = 0.1%
          },
          tokens: {
            flatFee: BigInt(10000000000000000),
            scalarBps: 1,
          },
        });

        const smallIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(2000000000001), // Slightly above required fee
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(1000000000000000), // 0.001 ETH
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
        (fulfillmentConfigService as any)._nativeFee = {
          baseFee: BigInt(0),
          bpsFee: 333, // 333 bps = 3.33%
        };
        (fulfillmentConfigService as any).getNetworkFee.mockReturnValue({
          native: {
            flatFee: BigInt(0),
            scalarBps: 3.33, // 333 bps = 3.33%
          },
          tokens: {
            flatFee: BigInt(10000000000000000),
            scalarBps: 1,
          },
        });

        const oddIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt('33300000000000001'), // Covers fee with odd percentage
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(1000000000000000000), // 1 ETH
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
          nativeValue: BigInt('5000000000000000000'), // 5 ETH reward
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x1234567890123456789012345678901234567890' as Address,
              data: '0x' as `0x${string}`,
              value: BigInt('2000000000000000000'), // 2 ETH native value
            },
          ],
        },
      });

      fulfillmentConfigService.getNetworkFee.mockReturnValue({
        native: {
          flatFee: '10000000000000000', // 0.01 ETH base fee
          scalarBps: 50, // 50 bps = 0.5%
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      expect(feeDetails).toEqual({
        baseFee: BigInt('10000000000000000'),
        percentageFee: BigInt('10000000000000000'), // 0.5% of 2 ETH
        totalRequiredFee: BigInt('20000000000000000'),
        currentReward: BigInt('5000000000000000000'),
        minimumRequiredReward: BigInt('20000000000000000'),
      });
    });

    it('should handle multiple calls with native values', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeValue: BigInt('10000000000000000000'), // 10 ETH reward
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x1111111111111111111111111111111111111111' as Address,
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH
            },
            {
              target: '0x2222222222222222222222222222222222222222' as Address,
              data: '0x' as `0x${string}`,
              value: BigInt('2000000000000000000'), // 2 ETH
            },
            {
              target: '0x3333333333333333333333333333333333333333' as Address,
              data: '0x' as `0x${string}`,
              value: BigInt('500000000000000000'), // 0.5 ETH
            },
          ],
        },
      });

      fulfillmentConfigService.getNetworkFee.mockReturnValue({
        native: {
          flatFee: '20000000000000000', // 0.02 ETH
          scalarBps: 200, // 200 bps = 2%
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Total native value = 3.5 ETH
      // Percentage fee = 3.5 ETH * 2% = 0.07 ETH
      expect(feeDetails).toEqual({
        baseFee: BigInt('20000000000000000'),
        percentageFee: BigInt('70000000000000000'),
        totalRequiredFee: BigInt('90000000000000000'),
        currentReward: BigInt('10000000000000000000'),
        minimumRequiredReward: BigInt('90000000000000000'),
      });
    });

    it('should handle zero native value in calls', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeValue: BigInt('1000000000000000000'),
        },
        route: {
          ...mockIntent.route,
          calls: [], // No calls with native value
        },
      });

      fulfillmentConfigService.getNetworkFee.mockReturnValue({
        native: {
          flatFee: '5000000000000000',
          scalarBps: 100,
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      expect(feeDetails).toEqual({
        baseFee: BigInt('5000000000000000'),
        percentageFee: BigInt('0'), // 0% of 0
        totalRequiredFee: BigInt('5000000000000000'),
        currentReward: BigInt('1000000000000000000'),
        minimumRequiredReward: BigInt('5000000000000000'),
      });
    });

    it('should handle undefined fee config values', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeValue: BigInt('1000000000000000000'),
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x1234567890123456789012345678901234567890' as Address,
              data: '0x' as `0x${string}`,
              value: BigInt('500000000000000000'),
            },
          ],
        },
      });

      fulfillmentConfigService.getNetworkFee.mockReturnValue({
        native: {
          flatFee: undefined,
          scalarBps: undefined,
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      expect(feeDetails).toEqual({
        baseFee: BigInt('0'),
        percentageFee: BigInt('0'),
        totalRequiredFee: BigInt('0'),
        currentReward: BigInt('1000000000000000000'),
        minimumRequiredReward: BigInt('0'),
      });
    });

    it('should handle high precision scalar calculations', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeValue: BigInt('1000000000000000000'),
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x1234567890123456789012345678901234567890' as Address,
              data: '0x' as `0x${string}`,
              value: BigInt('1234567890123456789'), // ~1.234 ETH
            },
          ],
        },
      });

      fulfillmentConfigService.getNetworkFee.mockReturnValue({
        native: {
          flatFee: '0',
          scalarBps: 25, // 25 bps = 0.25%
        },
      });

      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Expected: 1234567890123456789 * 25 * 1000 / (1000 * 10000) = 3086419725308641
      expect(feeDetails.percentageFee).toBe(BigInt('3086419725308641'));
    });
  });

  describe('validate and calculateFee consistency', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    it('should use the same calculation logic', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeValue: BigInt('50000000000000000'), // 0.05 ETH reward
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x1234567890123456789012345678901234567890' as Address,
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH native value
            },
          ],
        },
      });

      fulfillmentConfigService.getNetworkFee.mockReturnValue({
        native: {
          flatFee: '30000000000000000', // 0.03 ETH
          scalarBps: 20, // 20 bps = 0.2%
        },
      });

      // Calculate fee details
      const feeDetails = await (validation as any).calculateFee(intent, mockContext);

      // Reset mock
      jest.clearAllMocks();
      fulfillmentConfigService.getNetworkFee.mockReturnValue({
        native: {
          flatFee: '30000000000000000',
          scalarBps: 20,
        },
      });

      // Validate should pass because currentReward >= totalRequiredFee
      const isValid = await validation.validate(intent, mockContext);

      expect(isValid).toBe(true);
      expect(feeDetails.currentReward).toBe(BigInt('50000000000000000'));
      expect(feeDetails.totalRequiredFee).toBe(BigInt('32000000000000000')); // 0.03 + 0.002
    });

    it('should pass validation when reward covers the native fee using calculateFee', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeValue: BigInt('2000000000000000000'), // 2 ETH reward
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x1234567890123456789012345678901234567890' as Address,
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH native value in call
            },
          ],
        },
      });

      fulfillmentConfigService.getNetworkFee.mockReturnValue({
        native: {
          flatFee: '1000000000000000', // 0.001 ETH
          scalarBps: 100, // 100 bps = 1%
        },
      });

      const result = await validation.validate(intent, mockContext);

      expect(result).toBe(true);
      expect(fulfillmentConfigService.getNetworkFee).toHaveBeenCalledWith(BigInt('10'));
    });

    it('should throw error when reward does not cover the native fee using calculateFee', async () => {
      const intent = createMockIntent({
        reward: {
          ...mockIntent.reward,
          nativeValue: BigInt('5000000000000000'), // 0.005 ETH reward (too low)
        },
        route: {
          ...mockIntent.route,
          calls: [
            {
              target: '0x1234567890123456789012345678901234567890' as Address,
              data: '0x' as `0x${string}`,
              value: BigInt('1000000000000000000'), // 1 ETH native value
            },
          ],
        },
      });

      fulfillmentConfigService.getNetworkFee.mockReturnValue({
        native: {
          flatFee: '10000000000000000', // 0.01 ETH base fee
          scalarBps: 100, // 100 bps = 1%
        },
      });

      await expect(validation.validate(intent, mockContext)).rejects.toThrow(
        'Reward 5000000000000000 is less than required native fee 20000000000000000 (base: 10000000000000000, percentage: 10000000000000000)',
      );
    });
  });
});
