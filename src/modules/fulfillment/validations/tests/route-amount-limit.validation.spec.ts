import { Test } from '@nestjs/testing';

import { Address } from 'viem';

import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { RouteAmountLimitValidation } from '../route-amount-limit.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('RouteAmountLimitValidation', () => {
  let validation: RouteAmountLimitValidation;
  let fulfillmentConfigService: jest.Mocked<FulfillmentConfigService>;

  beforeEach(async () => {
    const mockFulfillmentConfigService = {
      normalize: jest.fn(),
      getToken: jest.fn(),
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
    const mockContext = createMockValidationContext();

    describe('within limits', () => {
      it('should return true when total value is within limit', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address, // USDC
                amount: BigInt(100000000), // 100 USDC (6 decimals)
              },
            ],
          },
        });

        // Mock normalize to return normalized amounts (18 decimals)
        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt('100000000000000000000'), // 100 normalized to 18 decimals
          },
        ]);

        // Mock getToken to return token config with limit
        fulfillmentConfigService.getToken.mockReturnValue({
          address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          decimals: 6,
          limit: 1000, // 1000 USDC limit
        });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
        expect(fulfillmentConfigService.normalize).toHaveBeenCalledWith(
          BigInt(10),
          mockIntent.route.tokens,
        );
        expect(fulfillmentConfigService.getToken).toHaveBeenCalledWith(
          BigInt(10),
          '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });

      it('should return true when total value equals limit', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(1000000000), // 1000 USDC (6 decimals)
              },
            ],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt('1000000000000000000000'), // 1000 normalized
          },
        ]);

        fulfillmentConfigService.getToken.mockReturnValue({
          address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          decimals: 6,
          limit: 1000,
        });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should return true when no tokens in route', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([]);

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });
    });

    describe('exceeds limits', () => {
      it('should throw error when total value exceeds limit', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(2000000000), // 2000 USDC
              },
            ],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt('2000000000000000000000'), // 2000 normalized
          },
        ]);

        fulfillmentConfigService.getToken.mockReturnValue({
          address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          decimals: 6,
          limit: 1000, // Limit is 1000 USDC
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 2000000000000000000000 exceeds route limit 1000000000000000000000 for route 1-10',
        );
      });

      it('should throw error when total value is 1 wei over limit', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(1000000001), // Slightly over 1000 USDC
              },
            ],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt('1000000000000000000001'), // 1 wei over 1000
          },
        ]);

        fulfillmentConfigService.getToken.mockReturnValue({
          address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          decimals: 6,
          limit: 1000,
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 1000000000000000000001 exceeds route limit 1000000000000000000000 for route 1-10',
        );
      });
    });

    describe('multiple tokens', () => {
      it('should use the smallest token limit when multiple tokens', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address, // USDC
                amount: BigInt(400000000), // 400 USDC
              },
              {
                token: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' as Address, // USDT
                amount: BigInt(300000000), // 300 USDT
              },
            ],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt('400000000000000000000'), // 400 normalized
          },
          {
            token: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' as Address,
            decimals: 18,
            amount: BigInt('300000000000000000000'), // 300 normalized
          },
        ]);

        fulfillmentConfigService.getToken
          .mockReturnValueOnce({
            address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            decimals: 6,
            limit: 1000, // USDC limit is 1000
          })
          .mockReturnValueOnce({
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            decimals: 6,
            limit: 500, // USDT limit is 500 (smaller)
          });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 700000000000000000000 exceeds route limit 500000000000000000000 for route 1-10',
        );
      });

      it('should throw error when total exceeds smallest token limit', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(300000000), // 300 USDC
              },
              {
                token: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' as Address,
                amount: BigInt(300000000), // 300 USDT
              },
            ],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt('300000000000000000000'), // 300 normalized
          },
          {
            token: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' as Address,
            decimals: 18,
            amount: BigInt('300000000000000000000'), // 300 normalized
          },
        ]);

        fulfillmentConfigService.getToken
          .mockReturnValueOnce({
            address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            decimals: 6,
            limit: 1000,
          })
          .mockReturnValueOnce({
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            decimals: 6,
            limit: 500, // Smallest limit
          });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 600000000000000000000 exceeds route limit 500000000000000000000 for route 1-10',
        );
      });
    });

    describe('different decimal tokens', () => {
      it('should handle tokens with different decimals correctly', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address, // USDC (6 decimals)
                amount: BigInt(100000000), // 100 USDC
              },
              {
                token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address, // DAI (18 decimals)
                amount: BigInt('100000000000000000000'), // 100 DAI
              },
            ],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt('100000000000000000000'), // 100 normalized
          },
          {
            token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
            decimals: 18,
            amount: BigInt('100000000000000000000'), // 100 normalized
          },
        ]);

        fulfillmentConfigService.getToken
          .mockReturnValueOnce({
            address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            decimals: 6,
            limit: 1000,
          })
          .mockReturnValueOnce({
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 18,
            limit: 1000,
          });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true); // Total 200 is within limit of 1000
      });
    });

    describe('edge cases', () => {
      it('should handle very large amounts', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt('1000000000000000000'), // Very large amount
              },
            ],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt('1000000000000000000000000000'), // 1 billion normalized to 18 decimals
          },
        ]);

        fulfillmentConfigService.getToken.mockReturnValue({
          address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          decimals: 6,
          limit: 10000000000, // 10 billion limit (larger than amount)
        });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle zero amounts', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(0),
              },
            ],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt(0),
          },
        ]);

        fulfillmentConfigService.getToken.mockReturnValue({
          address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          decimals: 6,
          limit: 1000,
        });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle different source and destination chains in error message', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            source: BigInt(137), // Polygon
            destination: BigInt(42161), // Arbitrum
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(2000000000),
              },
            ],
          },
        });

        fulfillmentConfigService.normalize.mockReturnValue([
          {
            token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
            decimals: 18,
            amount: BigInt('2000000000000000000000'),
          },
        ]);

        fulfillmentConfigService.getToken.mockReturnValue({
          address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          decimals: 6,
          limit: 1000,
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 2000000000000000000000 exceeds route limit 1000000000000000000000 for route 137-42161',
        );
      });
    });
  });
});