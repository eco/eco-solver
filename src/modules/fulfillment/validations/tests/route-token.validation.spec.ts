import { Test } from '@nestjs/testing';

import { Address } from 'viem';

import { EvmConfigService } from '@/modules/config/services/evm-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { RouteTokenValidation } from '../route-token.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('RouteTokenValidation', () => {
  let validation: RouteTokenValidation;
  let evmConfigService: jest.Mocked<EvmConfigService>;

  beforeEach(async () => {
    const mockEvmConfigService = {
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
          provide: EvmConfigService,
          useValue: mockEvmConfigService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<RouteTokenValidation>(RouteTokenValidation);
    evmConfigService = module.get(EvmConfigService);
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
        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should throw error when native value transfer exists in calls', async () => {
        const intentWithNativeTransfer = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
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
        const intentWithTokens = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(1000),
              },
              {
                token: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' as Address,
                amount: BigInt(2000),
              },
            ],
          },
        });

        // Mock that both tokens are supported on destination chain
        evmConfigService.isTokenSupported
          .mockReturnValueOnce(true) // First token
          .mockReturnValueOnce(true); // Second token

        const result = await validation.validate(intentWithTokens, mockContext);

        expect(result).toBe(true);
        expect(evmConfigService.isTokenSupported).toHaveBeenCalledWith(
          10,
          '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
        expect(evmConfigService.isTokenSupported).toHaveBeenCalledWith(
          10,
          '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        );
      });

      it('should throw error when route token is not supported on destination', async () => {
        const intentWithUnsupportedToken = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(1000),
              },
              {
                token: '0xUNSUPPORTEDTOKENADDRESS123456789012345678' as Address,
                amount: BigInt(2000),
              },
            ],
          },
        });

        // Mock that first token is supported, second is not
        evmConfigService.isTokenSupported
          .mockReturnValueOnce(true) // First token
          .mockReturnValueOnce(false); // Second token

        await expect(validation.validate(intentWithUnsupportedToken, mockContext)).rejects.toThrow(
          'Token 0xUNSUPPORTEDTOKENADDRESS123456789012345678 is not supported on chain 10',
        );
      });

      it('should handle case-insensitive token addresses', async () => {
        const intentWithMixedCase = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x7f5c764cbc14f9669b88837ca1490cca17c31607' as Address,
                amount: BigInt(1000),
              }, // lowercase
            ],
          },
        });

        // Mock that token is supported
        evmConfigService.isTokenSupported.mockReturnValue(true);

        const result = await validation.validate(intentWithMixedCase, mockContext);

        expect(result).toBe(true);
        expect(evmConfigService.isTokenSupported).toHaveBeenCalledWith(
          10,
          '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
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
                token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
                amount: BigInt(100),
              },
              {
                token: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address,
                amount: BigInt(200),
              },
            ],
          },
        });

        // Mock that both reward tokens are supported on source chain
        evmConfigService.isTokenSupported
          .mockReturnValueOnce(true) // First reward token
          .mockReturnValueOnce(true); // Second reward token

        const result = await validation.validate(intentWithRewardTokens, mockContext);

        expect(result).toBe(true);
        expect(evmConfigService.isTokenSupported).toHaveBeenCalledWith(
          1,
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        );
        expect(evmConfigService.isTokenSupported).toHaveBeenCalledWith(
          1,
          '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        );
      });

      it('should throw error when reward token is not supported on source', async () => {
        const intentWithUnsupportedReward = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
                amount: BigInt(100),
              },
              {
                token: '0xINVALIDTOKENADDRESS123456789012345678901' as Address,
                amount: BigInt(200),
              },
            ],
          },
        });

        // Mock that first reward token is supported, second is not
        evmConfigService.isTokenSupported
          .mockReturnValueOnce(true) // First reward token
          .mockReturnValueOnce(false); // Second reward token

        await expect(validation.validate(intentWithUnsupportedReward, mockContext)).rejects.toThrow(
          'Reward token 0xINVALIDTOKENADDRESS123456789012345678901 is not supported on chain 1',
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
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(1000),
              },
            ],
          },
        });

        // Mock that isTokenSupported returns true (token is supported)
        evmConfigService.isTokenSupported.mockReturnValue(true);

        const result = await validation.validate(intentWithTokens, mockContext);

        expect(result).toBe(true);
        expect(evmConfigService.isTokenSupported).toHaveBeenCalledWith(
          10,
          '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });

      it('should handle when isTokenSupported returns false', async () => {
        const intentWithTokens = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(1000),
              },
            ],
          },
        });

        // Mock that isTokenSupported returns false (token is not supported)
        evmConfigService.isTokenSupported.mockReturnValue(false);

        await expect(validation.validate(intentWithTokens, mockContext)).rejects.toThrow(
          'Token 0x7F5c764cBc14f9669B88837ca1490cCa17c31607 is not supported on chain 10',
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
                token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
                amount: BigInt(100),
              },
            ],
          },
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0x095ea7b3' as `0x${string}`,
                value: BigInt(0),
              },
              {
                target: '0x6666666666666666666666666666666666666666' as Address,
                data: '0xa9059cbb' as `0x${string}`,
                value: BigInt(0),
              },
            ],
            tokens: [
              {
                token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                amount: BigInt(1000),
              },
            ],
          },
        });

        // Mock that all tokens are supported
        evmConfigService.isTokenSupported
          .mockReturnValueOnce(true) // Route token on destination
          .mockReturnValueOnce(true); // Reward token on source

        const result = await validation.validate(complexIntent, mockContext);

        expect(result).toBe(true);
        expect(evmConfigService.isTokenSupported).toHaveBeenCalledTimes(2);
        expect(evmConfigService.isTokenSupported).toHaveBeenCalledWith(
          10,
          '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        ); // Route token
        expect(evmConfigService.isTokenSupported).toHaveBeenCalledWith(
          1,
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        ); // Reward token
      });
    });
  });
});
