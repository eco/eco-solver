import { Test, TestingModule } from '@nestjs/testing';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { Address } from 'viem';

import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';

import { MinimumRouteAmountValidation } from '../minimum-route-amount.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('MinimumRouteAmountValidation', () => {
  let validation: MinimumRouteAmountValidation;
  let mockFulfillmentConfigService: jest.Mocked<FulfillmentConfigService>;

  beforeEach(async () => {
    mockFulfillmentConfigService = {
      normalize: jest.fn(),
      getToken: jest.fn(),
    } as any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinimumRouteAmountValidation,
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

    validation = module.get<MinimumRouteAmountValidation>(MinimumRouteAmountValidation);
  });

  describe('validate', () => {
    it('should pass when total value meets minimum from object format', async () => {
      const intent = createMockIntent({
        route: {
          source: BigInt(1),
          destination: BigInt(42),
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as any,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
          calls: [],
          tokens: [
            {
              token: '0x1234567890123456789012345678901234567890' as Address,
              amount: BigInt(2000000000000000000), // 2 ETH
            },
          ],
        },
      });

      // Mock normalize to return the same tokens with normalized amounts
      mockFulfillmentConfigService.normalize.mockReturnValue([
        {
          token: '0x1234567890123456789012345678901234567890' as Address,
          decimals: 18,
          amount: BigInt(2000000000000000000),
        }, // 2 ETH normalized
      ]);

      // Mock getToken to return object format with min
      mockFulfillmentConfigService.getToken.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        limit: { min: 1, max: 1000 }, // Min is 1 ETH
      });

      const context = createMockValidationContext();
      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
      expect(mockFulfillmentConfigService.normalize).toHaveBeenCalledWith(
        BigInt(42),
        intent.route.tokens,
      );
      expect(mockFulfillmentConfigService.getToken).toHaveBeenCalledWith(
        BigInt(42),
        '0x1234567890123456789012345678901234567890',
      );
    });

    it('should pass when no minimum is set (number format)', async () => {
      const intent = createMockIntent({
        route: {
          source: BigInt(1),
          destination: BigInt(10),
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as any,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
          calls: [],
          tokens: [
            {
              token: '0x1234567890123456789012345678901234567890' as Address,
              amount: BigInt(100000000000000000), // 0.1 ETH
            },
          ],
        },
      });

      // Mock normalize to return normalized amount
      mockFulfillmentConfigService.normalize.mockReturnValue([
        {
          token: '0x1234567890123456789012345678901234567890' as Address,
          decimals: 18,
          amount: BigInt(100000000000000000),
        }, // 0.1 ETH normalized
      ]);

      // Mock getToken to return number format (no minimum)
      mockFulfillmentConfigService.getToken.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        limit: 1000, // Number format has no minimum
      });

      const context = createMockValidationContext();
      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
    });

    it('should fail when total value is below minimum in object format', async () => {
      const intent = createMockIntent({
        route: {
          source: BigInt(1),
          destination: BigInt(42),
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as any,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
          calls: [],
          tokens: [
            {
              token: '0x1234567890123456789012345678901234567890' as Address,
              amount: BigInt(500000000000000000), // 0.5 ETH
            },
          ],
        },
      });

      // Mock normalize to return normalized amount
      mockFulfillmentConfigService.normalize.mockReturnValue([
        {
          token: '0x1234567890123456789012345678901234567890' as Address,
          decimals: 18,
          amount: BigInt(500000000000000000),
        }, // 0.5 ETH normalized
      ]);

      // Mock getToken to return object format with min
      mockFulfillmentConfigService.getToken.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        limit: { min: 1, max: 1000 }, // Min is 1 ETH
      });

      const context = createMockValidationContext();

      await expect(validation.validate(intent, context)).rejects.toThrow(
        'Total route value 500000000000000000 is below minimum amount 1000000000000000000 for destination chain 42',
      );
    });

    it('should use smallest minimum when multiple tokens have different mins', async () => {
      const intent = createMockIntent({
        route: {
          source: BigInt(1),
          destination: BigInt(137),
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as any,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
          calls: [],
          tokens: [
            {
              token: '0x1234567890123456789012345678901234567890' as Address,
              amount: BigInt(400000000), // 400 USDC
            },
            {
              token: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
              amount: BigInt(300000000), // 300 USDT
            },
          ],
        },
      });

      // Mock normalize to return normalized amounts
      mockFulfillmentConfigService.normalize.mockReturnValue([
        {
          token: '0x1234567890123456789012345678901234567890' as Address,
          decimals: 18,
          amount: BigInt(400000000000000000000),
        }, // 400 normalized
        {
          token: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          decimals: 18,
          amount: BigInt(300000000000000000000),
        }, // 300 normalized
      ]);

      // Mock getToken to return different minimums
      mockFulfillmentConfigService.getToken
        .mockReturnValueOnce({
          address: '0x1234567890123456789012345678901234567890',
          decimals: 6,
          limit: { min: 1000, max: 10000 }, // Min is 1000
        })
        .mockReturnValueOnce({
          address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          decimals: 6,
          limit: { min: 2000, max: 10000 }, // Min is 2000 (larger)
        });

      const context = createMockValidationContext();

      await expect(validation.validate(intent, context)).rejects.toThrow(
        'Total route value 700000000000000000000 is below minimum amount 1000000000000000000000 for destination chain 137',
      );
    });

    it('should handle multiple tokens and sum their values', async () => {
      const intent = createMockIntent({
        route: {
          source: BigInt(1),
          destination: BigInt(10),
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as any,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
          calls: [],
          tokens: [
            {
              token: '0x1234567890123456789012345678901234567890' as Address,
              amount: BigInt(200000000000000000), // 0.2 ETH
            },
            {
              token: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
              amount: BigInt(400000000000000000), // 0.4 ETH
            },
          ],
        },
      });

      // Mock normalize to return normalized amounts
      mockFulfillmentConfigService.normalize.mockReturnValue([
        {
          token: '0x1234567890123456789012345678901234567890' as Address,
          decimals: 18,
          amount: BigInt(200000000000000000),
        }, // 0.2 ETH
        {
          token: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          decimals: 18,
          amount: BigInt(400000000000000000),
        }, // 0.4 ETH
      ]);

      // Mock getToken to return minimum for each token
      mockFulfillmentConfigService.getToken
        .mockReturnValueOnce({
          address: '0x1234567890123456789012345678901234567890',
          decimals: 18,
          limit: { min: 0.5, max: 1000 }, // Min is 0.5 ETH
        })
        .mockReturnValueOnce({
          address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          decimals: 18,
          limit: { min: 0.3, max: 1000 }, // Min is 0.3 ETH
        });

      const context = createMockValidationContext();
      const result = await validation.validate(intent, context);

      expect(result).toBe(true); // Total 0.6 ETH > 0.3 ETH minimum (smallest min)
    });

    it('should pass when no tokens have minimum requirements', async () => {
      const intent = createMockIntent({
        route: {
          source: BigInt(1),
          destination: BigInt(10),
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as any,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
          calls: [],
          tokens: [
            {
              token: '0x1234567890123456789012345678901234567890' as Address,
              amount: BigInt(1), // Very small amount
            },
          ],
        },
      });

      // Mock normalize to return small amount
      mockFulfillmentConfigService.normalize.mockReturnValue([
        {
          token: '0x1234567890123456789012345678901234567890' as Address,
          decimals: 18,
          amount: BigInt(1),
        },
      ]);

      // Mock getToken to return no limit
      mockFulfillmentConfigService.getToken.mockReturnValue({
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        // No limit property
      });

      const context = createMockValidationContext();
      const result = await validation.validate(intent, context);

      expect(result).toBe(true); // No minimum requirement
    });
  });
});
