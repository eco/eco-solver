import { Test } from '@nestjs/testing';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { RouteAmountLimitValidation } from '../route-amount-limit.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

// Helper function to cast string to UniversalAddress
const toUniversalAddress = (address: string): UniversalAddress => address as UniversalAddress;

describe('RouteAmountLimitValidation', () => {
  let validation: RouteAmountLimitValidation;
  let tokenConfigService: jest.Mocked<TokenConfigService>;

  beforeEach(async () => {
    const mockTokenConfigService = {
      normalize: jest.fn(),
      getTokenConfig: jest.fn(),
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
        RouteAmountLimitValidation,
        {
          provide: TokenConfigService,
          useValue: mockTokenConfigService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<RouteAmountLimitValidation>(RouteAmountLimitValidation);
    tokenConfigService = module.get(TokenConfigService);
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
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC
                amount: BigInt(100000000), // 100 USDC (6 decimals)
              },
            ],
          },
        });

        // Mock normalize to return normalized amounts (18 decimals)
        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('100000000000000000000'), // 100 normalized to 18 decimals
          },
        ]);

        // Mock getTokenConfig to return token config with limit
        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          limit: { max: 1000 }, // 1000 USDC limit (acts as max)
        });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
        expect(tokenConfigService.normalize).toHaveBeenCalledWith(
          mockIntent.destination,
          mockIntent.route.tokens,
        );
        expect(tokenConfigService.getTokenConfig).toHaveBeenCalledWith(
          mockIntent.destination,
          '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });

      it('should return true when total value equals limit', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(1000000000), // 1000 USDC (6 decimals)
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('1000000000000000000000'), // 1000 normalized
          },
        ]);

        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          limit: { max: 1000 },
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

        tokenConfigService.normalize.mockReturnValue([]);

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
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(2000000000), // 2000 USDC
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('2000000000000000000000'), // 2000 normalized
          },
        ]);

        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          limit: { max: 1000 }, // Limit is 1000 USDC
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 2000 exceeds route limit 1000 for route 8453-10',
        );
      });

      it('should throw error when total value is 1 wei over limit', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(1000000001), // Slightly over 1000 USDC
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('1000000000000000000001'), // 1 wei over 1000
          },
        ]);

        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          limit: { max: 1000 },
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 1000.000000000000000001 exceeds route limit 1000 for route 8453-10',
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
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC
                amount: BigInt(400000000), // 400 USDC
              },
              {
                token: toUniversalAddress(
                  '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
                ), // USDT
                amount: BigInt(300000000), // 300 USDT
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('400000000000000000000'), // 400 normalized
          },
          {
            token: toUniversalAddress(
              '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
            ),
            decimals: 18,
            amount: BigInt('300000000000000000000'), // 300 normalized
          },
        ]);

        tokenConfigService.getTokenConfig
          .mockReturnValueOnce({
            address: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 6,
            symbol: 'USDC',
            limit: { max: 1000 }, // USDC limit is 1000
          })
          .mockReturnValueOnce({
            address: toUniversalAddress(
              '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
            ),
            decimals: 6,
            symbol: 'USDC',
            limit: { max: 500 }, // USDT limit is 500 (smaller)
          });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 700 exceeds route limit 500 for route 8453-10',
        );
      });

      it('should throw error when total exceeds smallest token limit', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(300000000), // 300 USDC
              },
              {
                token: toUniversalAddress(
                  '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
                ),
                amount: BigInt(300000000), // 300 USDT
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('300000000000000000000'), // 300 normalized
          },
          {
            token: toUniversalAddress(
              '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
            ),
            decimals: 18,
            amount: BigInt('300000000000000000000'), // 300 normalized
          },
        ]);

        tokenConfigService.getTokenConfig
          .mockReturnValueOnce({
            address: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 6,
            symbol: 'USDC',
            limit: { max: 1000 },
          })
          .mockReturnValueOnce({
            address: toUniversalAddress(
              '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
            ),
            decimals: 6,
            symbol: 'USDC',
            limit: { max: 500 }, // Smallest limit
          });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 600 exceeds route limit 500 for route 8453-10',
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
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC (6 decimals)
                amount: BigInt(100000000), // 100 USDC
              },
              {
                token: toUniversalAddress(
                  '0x000000000000000000000000A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                ), // DAI (18 decimals)
                amount: BigInt('100000000000000000000'), // 100 DAI
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('100000000000000000000'), // 100 normalized
          },
          {
            token: toUniversalAddress(
              '0x000000000000000000000000A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            ),
            decimals: 18,
            amount: BigInt('100000000000000000000'), // 100 normalized
          },
        ]);

        tokenConfigService.getTokenConfig
          .mockReturnValueOnce({
            address: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 6,
            symbol: 'USDC',
            limit: { max: 1000 },
          })
          .mockReturnValueOnce({
            address: toUniversalAddress(
              '0x000000000000000000000000A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            ),
            decimals: 18,
            symbol: 'WETH',
            limit: { max: 1000 },
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
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt('1000000000000000000'), // Very large amount
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('1000000000000000000000000000'), // 1 billion normalized to 18 decimals
          },
        ]);

        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          limit: { max: 10000000000 }, // 10 billion limit (larger than amount)
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
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt(0),
          },
        ]);

        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          limit: { max: 1000 },
        });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should handle different source and destination chains in error message', async () => {
        const mockIntent = createMockIntent({
          sourceChainId: BigInt(137), // Polygon
          destination: BigInt(42161), // Arbitrum
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(2000000000),
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('2000000000000000000000'),
          },
        ]);

        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          limit: { max: 1000 },
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 2000 exceeds route limit 1000 for route 137-42161',
        );
      });
    });

    describe('object format limits', () => {
      it('should handle object format with min and max', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(800000000), // 800 USDC
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('800000000000000000000'), // 800 normalized
          },
        ]);

        // Mock getToken to return object format limit
        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          limit: { min: 100, max: 1000 }, // Object format with min and max
        });

        const result = await validation.validate(mockIntent, mockContext);
        expect(result).toBe(true);
      });

      it('should throw error when exceeds max in object format', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(1500000000), // 1500 USDC
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('1500000000000000000000'), // 1500 normalized
          },
        ]);

        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          limit: { min: 100, max: 1000 }, // Max is 1000
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 1500 exceeds route limit 1000 for route 8453-10',
        );
      });

      it('should handle mixed limit formats across tokens', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(300000000), // 300 USDC
              },
              {
                token: toUniversalAddress(
                  '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
                ),
                amount: BigInt(200000000), // 200 USDT
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('300000000000000000000'), // 300 normalized
          },
          {
            token: toUniversalAddress(
              '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
            ),
            decimals: 18,
            amount: BigInt('200000000000000000000'), // 200 normalized
          },
        ]);

        tokenConfigService.getTokenConfig
          .mockReturnValueOnce({
            address: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 6,
            symbol: 'USDC',
            limit: { max: 1000 }, // Object format (max only)
          })
          .mockReturnValueOnce({
            address: toUniversalAddress(
              '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
            ),
            decimals: 6,
            symbol: 'USDC',
            limit: { min: 50, max: 400 }, // Object format
          });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Total value 500 exceeds route limit 400 for route 8453-10',
        ); // Total 500 > min(1000, 400) = 400
      });

      it('should handle no limit set', async () => {
        const mockIntent = createMockIntent({
          route: {
            ...createMockIntent().route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt('1000000000000'), // Very large amount
              },
            ],
          },
        });

        tokenConfigService.normalize.mockReturnValue([
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ),
            decimals: 18,
            amount: BigInt('1000000000000000000000000'), // Very large normalized
          },
        ]);

        // Mock getToken to return no limit
        tokenConfigService.getTokenConfig.mockReturnValue({
          address: toUniversalAddress(
            '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
          ),
          decimals: 6,
          symbol: 'USDC',
          // No limit property
        });

        const result = await validation.validate(mockIntent, mockContext);
        expect(result).toBe(true); // No limit means no restriction
      });
    });
  });
});
