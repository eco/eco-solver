import { Test } from '@nestjs/testing';

import { toUniversalAddress } from '@/common/types/universal-address.type';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { RouteTokenValidation } from '../route-token.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('RouteTokenValidation', () => {
  let validation: RouteTokenValidation;
  let tokenConfigService: jest.Mocked<TokenConfigService>;

  beforeEach(async () => {
    const mockTokenConfigService = {
      isTokenSupported: jest.fn(),
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
        RouteTokenValidation,
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

    validation = module.get<RouteTokenValidation>(RouteTokenValidation);
    tokenConfigService = module.get(TokenConfigService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent({
      reward: {
        ...createMockIntent().reward,
        nativeAmount: BigInt(0),
      },
    });
    const mockContext = createMockValidationContext();

    describe('native token transfer validation', () => {
      it('should return true when no native token transfers in calls', async () => {
        // Mock the default tokens as supported
        tokenConfigService.isTokenSupported.mockReturnValue(true);

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should throw error when native value transfer exists in calls', async () => {
        const intentWithNativeTransfer = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000005555555555555555555555555555555555555555',
                ),
                data: '0x' as `0x${string}`,
                value: BigInt(1000000000000000000), // 1 ETH
              },
            ],
          },
        });

        await expect(validation.validate(intentWithNativeTransfer, mockContext)).rejects.toThrow(
          'Native token transfers are not supported',
        );
      });
    });

    describe('route token validation', () => {
      it('should return true when all route tokens are supported on destination', async () => {
        // Mock all tokens as supported
        tokenConfigService.isTokenSupported.mockReturnValue(true);

        const intentWithTokens = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(1000),
              },
              {
                token: toUniversalAddress(
                  '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
                ),
                amount: BigInt(2000),
              },
            ],
          },
        });

        // Mock that both tokens are supported on destination chain
        tokenConfigService.isTokenSupported
          .mockReturnValueOnce(true) // First token
          .mockReturnValueOnce(true); // Second token

        const result = await validation.validate(intentWithTokens, mockContext);

        expect(result).toBe(true);
        expect(tokenConfigService.isTokenSupported).toHaveBeenCalledWith(
          Number(mockIntent.destination),
          toUniversalAddress('0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607'),
        );
        expect(tokenConfigService.isTokenSupported).toHaveBeenCalledWith(
          Number(mockIntent.destination),
          toUniversalAddress('0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58'),
        );
      });

      it('should throw error when route token is not supported on destination', async () => {
        const intentWithUnsupportedToken = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(1000),
              },
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000006666666666666666666666666666666666666666',
                ),
                amount: BigInt(2000),
              },
            ],
          },
        });

        // Mock that first token is supported, second is not
        tokenConfigService.isTokenSupported
          .mockReturnValueOnce(true) // First token
          .mockReturnValueOnce(false); // Second token

        await expect(validation.validate(intentWithUnsupportedToken, mockContext)).rejects.toThrow(
          'Token 0x0000000000000000000000006666666666666666666666666666666666666666 is not supported on chain 10',
        );
      });

      it('should handle case-insensitive token addresses', async () => {
        const intentWithMixedCase = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007f5c764cbc14f9669b88837ca1490cca17c31607',
                ),
                amount: BigInt(1000),
              }, // lowercase
            ],
          },
        });

        // Mock that token is supported
        tokenConfigService.isTokenSupported.mockReturnValue(true);

        const result = await validation.validate(intentWithMixedCase, mockContext);

        expect(result).toBe(true);
        expect(tokenConfigService.isTokenSupported).toHaveBeenCalledWith(
          Number(mockIntent.destination),
          '0x0000000000000000000000007f5c764cbc14f9669b88837ca1490cca17c31607',
        );
      });
    });

    describe('reward token validation', () => {
      it('should return true when all reward tokens are supported on source', async () => {
        const intentWithRewardTokens = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x000000000000000000000000A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                ),
                amount: BigInt(100),
              },
              {
                token: toUniversalAddress(
                  '0x000000000000000000000000dAC17F958D2ee523a2206206994597C13D831ec7',
                ),
                amount: BigInt(200),
              },
            ],
          },
        });

        // Mock that all tokens are supported (1 route token + 2 reward tokens)
        tokenConfigService.isTokenSupported
          .mockReturnValueOnce(true) // Route token
          .mockReturnValueOnce(true) // First reward token
          .mockReturnValueOnce(true); // Second reward token

        const result = await validation.validate(intentWithRewardTokens, mockContext);

        expect(result).toBe(true);
        expect(tokenConfigService.isTokenSupported).toHaveBeenCalledWith(
          Number(mockIntent.sourceChainId),
          toUniversalAddress('0x000000000000000000000000A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
        );
        expect(tokenConfigService.isTokenSupported).toHaveBeenCalledWith(
          Number(mockIntent.sourceChainId),
          toUniversalAddress('0x000000000000000000000000dAC17F958D2ee523a2206206994597C13D831ec7'),
        );
      });

      it('should throw error when reward token is not supported on source', async () => {
        const intentWithUnsupportedReward = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x000000000000000000000000A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                ),
                amount: BigInt(100),
              },
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007777777777777777777777777777777777777777',
                ),
                amount: BigInt(200),
              },
            ],
          },
        });

        // Mock that route token and first reward token are supported, second reward token is not
        tokenConfigService.isTokenSupported
          .mockReturnValueOnce(true) // Route token
          .mockReturnValueOnce(true) // First reward token
          .mockReturnValueOnce(false); // Second reward token

        await expect(validation.validate(intentWithUnsupportedReward, mockContext)).rejects.toThrow(
          'Reward token 0x0000000000000000000000007777777777777777777777777777777777777777 is not supported on chain 8453',
        );
      });
    });

    describe('network configuration', () => {
      it('should handle when isTokenSupported returns true for any token', async () => {
        const intentWithTokens = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(1000),
              },
            ],
          },
        });

        // Mock that isTokenSupported returns true (token is supported)
        tokenConfigService.isTokenSupported.mockReturnValue(true);

        const result = await validation.validate(intentWithTokens, mockContext);

        expect(result).toBe(true);
        expect(tokenConfigService.isTokenSupported).toHaveBeenCalledWith(
          Number(mockIntent.destination),
          toUniversalAddress('0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607'),
        );
      });

      it('should handle when isTokenSupported returns false', async () => {
        const intentWithTokens = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(1000),
              },
            ],
          },
        });

        // Mock that isTokenSupported returns false (token is not supported)
        tokenConfigService.isTokenSupported.mockReturnValue(false);

        await expect(validation.validate(intentWithTokens, mockContext)).rejects.toThrow(
          'Token 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607 is not supported on chain 10',
        );
      });
    });

    describe('complex scenarios', () => {
      it('should validate intent with multiple calls, route tokens, and reward tokens', async () => {
        const complexIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x000000000000000000000000A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                ),
                amount: BigInt(100),
              },
            ],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000005555555555555555555555555555555555555555',
                ),
                data: '0x095ea7b3' as `0x${string}`,
                value: BigInt(0),
              },
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000006666666666666666666666666666666666666666',
                ),
                data: '0xa9059cbb' as `0x${string}`,
                value: BigInt(0),
              },
            ],
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                amount: BigInt(1000),
              },
            ],
          },
        });

        // Mock that all tokens are supported
        tokenConfigService.isTokenSupported
          .mockReturnValueOnce(true) // Route token on destination
          .mockReturnValueOnce(true); // Reward token on source

        const result = await validation.validate(complexIntent, mockContext);

        expect(result).toBe(true);
        expect(tokenConfigService.isTokenSupported).toHaveBeenCalledTimes(2);
        expect(tokenConfigService.isTokenSupported).toHaveBeenCalledWith(
          Number(mockIntent.destination),
          toUniversalAddress('0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607'),
        ); // Route token
        expect(tokenConfigService.isTokenSupported).toHaveBeenCalledWith(
          Number(mockIntent.sourceChainId),
          toUniversalAddress('0x000000000000000000000000A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
        ); // Reward token
      });
    });
  });
});
