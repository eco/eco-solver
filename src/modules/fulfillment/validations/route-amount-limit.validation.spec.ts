import { Test } from '@nestjs/testing';

import { Address } from 'viem';

import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { RouteAmountLimitValidation } from './route-amount-limit.validation';
import { createMockIntent } from './test-helpers';

describe('RouteAmountLimitValidation', () => {
  let validation: RouteAmountLimitValidation;
  let fulfillmentConfigService: jest.Mocked<FulfillmentConfigService>;

  beforeEach(async () => {
    const mockFulfillmentConfigService = {
      getRouteLimitForChain: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        RouteAmountLimitValidation,
        {
          provide: FulfillmentConfigService,
          useValue: mockFulfillmentConfigService,
        },
      ],
    }).compile();

    validation = module.get<RouteAmountLimitValidation>(RouteAmountLimitValidation);
    fulfillmentConfigService = module.get(FulfillmentConfigService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();

    describe('total value calculation', () => {
      it('should pass when total value is under the limit', async () => {
        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(5000000000000000000)); // 5 ETH limit

        const result = await validation.validate(mockIntent);

        expect(result).toBe(true);
        expect(fulfillmentConfigService.getRouteLimitForChain).toHaveBeenCalledWith(BigInt(10));
      });

      it('should calculate total from native value only', async () => {
        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(2000000000000000000)); // 2 ETH limit

        const result = await validation.validate(mockIntent);

        expect(result).toBe(true);
      });

      it('should calculate total from tokens only', async () => {
        const intentWithTokens = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(0),
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(500000000000000000),
              },
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(300000000000000000),
              },
            ],
          },
        });

        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(1000000000000000000)); // 1 ETH limit

        const result = await validation.validate(intentWithTokens);

        expect(result).toBe(true); // 0.5 + 0.3 = 0.8 ETH < 1 ETH limit
      });

      it('should calculate total from call values only', async () => {
        const intentWithCalls = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(0),
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(200000000000000000), // 0.2 ETH
              },
              {
                target: '0x6666666666666666666666666666666666666666' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(400000000000000000), // 0.4 ETH
              },
            ],
          },
        });

        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(1000000000000000000)); // 1 ETH limit

        const result = await validation.validate(intentWithCalls);

        expect(result).toBe(true); // 0.2 + 0.4 = 0.6 ETH < 1 ETH limit
      });

      it('should calculate total from all sources combined', async () => {
        const intentWithAll = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(1000000000000000000), // 1 ETH
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(500000000000000000),
              }, // 0.5 ETH
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(300000000000000000),
              }, // 0.3 ETH
            ],
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(200000000000000000), // 0.2 ETH
              },
            ],
          },
        });

        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(3000000000000000000)); // 3 ETH limit

        const result = await validation.validate(intentWithAll);

        expect(result).toBe(true); // 1 + 0.5 + 0.3 + 0.2 = 2 ETH < 3 ETH limit
      });
    });

    describe('limit violations', () => {
      it('should throw error when total value exceeds limit', async () => {
        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(500000000000000000)); // 0.5 ETH limit

        await expect(validation.validate(mockIntent)).rejects.toThrow(
          'Total value 1000000000000000000 exceeds route limit 500000000000000000 for route 1-10',
        );
      });

      it('should pass when total exactly equals limit', async () => {
        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(1000000000000000000)); // 1 ETH limit

        const result = await validation.validate(mockIntent);

        expect(result).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should throw error for zero total value', async () => {
        const zeroValueIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(0),
          },
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [],
          },
        });

        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(1000000000000000000));

        await expect(validation.validate(zeroValueIntent)).rejects.toThrow(
          'Total intent value must be greater than 0',
        );
      });

      it('should handle very large numbers', async () => {
        const largeIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt('1000000000000000000000000'), // 1,000,000 ETH
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt('500000000000000000000000'), // 500,000 ETH
              },
            ],
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt('200000000000000000000000'), // 200,000 ETH
              },
            ],
          },
        });

        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(
          BigInt('2000000000000000000000000'),
        ); // 2,000,000 ETH limit

        const result = await validation.validate(largeIntent);

        expect(result).toBe(true); // 1,000,000 + 500,000 + 200,000 = 1,700,000 < 2,000,000
      });

      it('should handle empty arrays gracefully', async () => {
        const emptyArraysIntent = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [],
            calls: [],
          },
        });

        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(2000000000000000000));

        const result = await validation.validate(emptyArraysIntent);

        expect(result).toBe(true);
      });

      it('should handle multiple tokens and calls', async () => {
        const multipleItemsIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            nativeValue: BigInt(100000000000000000), // 0.1 ETH
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(50000000000000000),
              },
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(30000000000000000),
              },
              {
                token: '0x3333333333333333333333333333333333333333' as Address,
                amount: BigInt(20000000000000000),
              },
              {
                token: '0x4444444444444444444444444444444444444444' as Address,
                amount: BigInt(10000000000000000),
              },
            ],
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(25000000000000000),
              },
              {
                target: '0x6666666666666666666666666666666666666666' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(15000000000000000),
              },
              {
                target: '0x7777777777777777777777777777777777777777' as Address,
                data: '0x' as `0x${string}`,
                value: BigInt(5000000000000000),
              },
            ],
          },
        });

        fulfillmentConfigService.getRouteLimitForChain.mockReturnValue(BigInt(300000000000000000)); // 0.3 ETH limit

        const result = await validation.validate(multipleItemsIntent);

        expect(result).toBe(true); // Total: 0.255 ETH < 0.3 ETH limit
      });
    });
  });
});
