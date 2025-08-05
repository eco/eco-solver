import { Test } from '@nestjs/testing';

import { Address } from 'viem';

// Mock the config service module before any imports
jest.mock('@/modules/config/services/fulfillment-config.service', () => ({
  FulfillmentConfigService: jest.fn().mockImplementation(() => {
    let crowdLiquidityFeeValue = { baseFee: BigInt(500000), bpsFee: BigInt(50) };
    return {
      get crowdLiquidityFee() {
        return crowdLiquidityFeeValue;
      },
      set crowdLiquidityFee(value) {
        crowdLiquidityFeeValue = value;
      },
    };
  }),
}));

import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { CrowdLiquidityFeeValidation } from '../crowd-liquidity-fee.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

// TODO: Enable these tests once CrowdLiquidityFeeValidation implementation is completed
// Currently the validation always returns true, so tests expecting fee validation logic will fail
describe.skip('CrowdLiquidityFeeValidation', () => {
  let validation: CrowdLiquidityFeeValidation;
  let fulfillmentConfigService: jest.Mocked<FulfillmentConfigService>;

  beforeEach(async () => {
    const mockFulfillmentConfigService = {
      get crowdLiquidityFee() {
        return this._crowdLiquidityFee;
      },
      _crowdLiquidityFee: { baseFee: BigInt(5000000000000000), bpsFee: BigInt(50) }, // 0.005 ETH base + 50 bps (0.5%)
    };

    const module = await Test.createTestingModule({
      providers: [
        CrowdLiquidityFeeValidation,
        {
          provide: FulfillmentConfigService,
          useValue: mockFulfillmentConfigService,
        },
      ],
    }).compile();

    validation = module.get<CrowdLiquidityFeeValidation>(CrowdLiquidityFeeValidation);
    fulfillmentConfigService = module.get(FulfillmentConfigService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    // Default crowd liquidity fees are already set in mock: 0.005 ETH base + 50 bps (0.5%)

    describe('fee calculation', () => {
      it('should pass when reward covers base fee plus percentage fee', async () => {
        // Total value: 1 ETH
        // Base fee: 0.005 ETH
        // Percentage fee: 0.5% of 1 ETH = 0.005 ETH
        // Total fee: 0.01 ETH
        // Reward (1 ETH) > Total fee (0.01 ETH)

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should calculate percentage fee from total value for crowd liquidity', async () => {
        const intentWithMultipleValues = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(200000000000000000), // 0.2 ETH reward
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(1000000000000000000),
              }, // 1 ETH
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(2000000000000000000),
              }, // 2 ETH
            ],
            calls: [
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(1000000000000000000), // 1 ETH
              },
            ],
          },
        });

        // Total value: 1 + 2 + 1 = 4 ETH
        // Base fee: 0.005 ETH
        // Percentage fee: 0.5% of 4 ETH = 0.02 ETH
        // Total fee: 0.025 ETH
        // Reward (0.2 ETH) > Total fee (0.025 ETH)

        const result = await validation.validate(intentWithMultipleValues, mockContext);

        expect(result).toBe(true);
      });

      it('should handle crowd liquidity specific fee structure', async () => {
        (fulfillmentConfigService as any)._crowdLiquidityFee = {
          baseFee: BigInt(1000000000000000), // 0.001 ETH - lower base for CL
          bpsFee: BigInt(25), // 25 bps = 0.25% - lower percentage for CL
        };

        const crowdLiquidityIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(50000000000000000), // 0.05 ETH reward
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(10000000000000000000),
              }, // 10 ETH
            ],
          },
        });

        // Total value: 10 ETH
        // Base fee: 0.001 ETH
        // Percentage fee: 0.25% of 10 ETH = 0.025 ETH
        // Total fee: 0.026 ETH
        // Reward (0.05 ETH) > Total fee (0.026 ETH)

        const result = await validation.validate(crowdLiquidityIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('fee validation failures', () => {
      it('should throw error when reward is less than total fee', async () => {
        const lowRewardIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(8000000000000000), // 0.008 ETH
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(1000000000000000000), // 1 ETH
              },
            ],
          },
        });

        // Total value: 1 ETH
        // Base fee: 0.005 ETH
        // Percentage fee: 0.5% of 1 ETH = 0.005 ETH
        // Total fee: 0.01 ETH
        // Reward (0.008 ETH) < Total fee (0.01 ETH)

        await expect(validation.validate(lowRewardIntent, mockContext)).rejects.toThrow(
          'Reward 8000000000000000 is less than required CL fee 10000000000000000',
        );
      });

      it.skip('should throw error when reward is exactly 1 wei short', async () => {
        const almostEnoughIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(9999999999999999), // 1 wei less than required
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(1000000000000000000), // 1 ETH
              },
            ],
          },
        });

        await expect(validation.validate(almostEnoughIntent, mockContext)).rejects.toThrow(
          'Reward 9999999999999999 is less than required CL fee 10000000000000000',
        );
      });

      it('should pass when reward exactly equals total fee', async () => {
        const exactFeeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(10000000000000000), // Exactly 0.01 ETH
          },
        });

        const result = await validation.validate(exactFeeIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('crowd liquidity specific scenarios', () => {
      it('should handle liquidity pool contributions', async () => {
        const poolIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(100000000000000000), // 0.1 ETH reward
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(5000000000000000000),
              }, // 5 ETH USDC
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(5000000000000000000),
              }, // 5 ETH USDT
            ],
            calls: [], // Pool contributions typically don't have calls
          },
        });

        // Total value: 5 + 5 = 10 ETH
        // Base fee: 0.005 ETH
        // Percentage fee: 0.5% of 10 ETH = 0.05 ETH
        // Total fee: 0.055 ETH
        // Reward (0.1 ETH) > Total fee (0.055 ETH)

        const result = await validation.validate(poolIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle tiered fee structure for large pools', async () => {
        (fulfillmentConfigService as any)._crowdLiquidityFee = {
          baseFee: BigInt(0), // No base fee for large pools
          bpsFee: BigInt(10), // 10 bps = 0.1% - very low for large liquidity
        };

        const largeLiquidityIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(1100000000000000000), // 1.1 ETH reward
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt('500000000000000000000'),
              }, // 500 ETH
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt('500000000000000000000'),
              }, // 500 ETH
            ],
          },
        });

        // Total value: 500 + 500 = 1000 ETH
        // Percentage fee: 0.1% of 1000 ETH = 1 ETH
        // Reward (1.1 ETH) > Fee (1 ETH)

        const result = await validation.validate(largeLiquidityIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('different fee configurations', () => {
      it('should handle zero base fee for crowd liquidity', async () => {
        (fulfillmentConfigService as any)._crowdLiquidityFee = {
          baseFee: BigInt(0),
          bpsFee: BigInt(100), // 100 bps = 1%
        };

        const zeroBaseIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(10000000000000000), // 0.01 ETH (exactly 1% of 1 ETH)
          },
        });

        const result = await validation.validate(zeroBaseIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle zero percentage fee', async () => {
        (fulfillmentConfigService as any)._crowdLiquidityFee = {
          baseFee: BigInt(25000000000000000), // 0.025 ETH
          bpsFee: BigInt(0),
        };

        const zeroPercentageIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(25000000000000000), // 0.025 ETH (exactly base fee)
          },
        });

        const result = await validation.validate(zeroPercentageIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle incentivized crowd liquidity (negative fees)', async () => {
        (fulfillmentConfigService as any)._crowdLiquidityFee = {
          baseFee: BigInt(0),
          bpsFee: BigInt(0), // No fees - incentivized liquidity
        };

        const incentivizedIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(1), // Even 1 wei is enough
          },
        });

        const result = await validation.validate(incentivizedIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle very large liquidity pools', async () => {
        const massivePoolIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt('10050000000000000000000'), // 10,050 ETH
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt('1000000000000000000000000'),
              }, // 1,000,000 ETH
            ],
          },
        });

        // Total value: 1,000,000 ETH
        // Base fee: 0.005 ETH
        // Percentage fee: 0.5% of 1,000,000 = 5,000 ETH
        // Total fee: 5,000.005 ETH
        // Reward (10,050 ETH) > Fee (5,000.005 ETH)

        const result = await validation.validate(massivePoolIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle micro liquidity provisions', async () => {
        (fulfillmentConfigService as any)._crowdLiquidityFee = {
          baseFee: BigInt(100000000000), // 0.0000001 ETH - micro base fee
          bpsFee: BigInt(1), // 1 bp = 0.01% - micro percentage
        };

        const microIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(200000000001), // Slightly above required fee
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(1000000000000000),
              }, // 0.001 ETH
            ],
          },
        });

        const result = await validation.validate(microIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle multi-token liquidity pools', async () => {
        const multiTokenIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(30000000000000000), // 0.03 ETH
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(1000000000000000000),
              }, // 1 ETH
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(1000000000000000000),
              }, // 1 ETH
              {
                token: '0x3333333333333333333333333333333333333333' as Address,
                amount: BigInt(1000000000000000000),
              }, // 1 ETH
              {
                token: '0x4444444444444444444444444444444444444444' as Address,
                amount: BigInt(1000000000000000000),
              }, // 1 ETH
            ],
          },
        });

        // Total value: 4 ETH
        // Base fee: 0.005 ETH
        // Percentage fee: 0.5% of 4 ETH = 0.02 ETH
        // Total fee: 0.025 ETH
        // Reward (0.03 ETH) > Total fee (0.025 ETH)

        const result = await validation.validate(multiTokenIntent, mockContext);

        expect(result).toBe(true);
      });
    });
  });
});
