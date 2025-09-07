import { Test } from '@nestjs/testing';

import { toUniversalAddress } from '@/common/types/universal-address.type';
import { TokenConfigService } from '@/modules/config/services/token-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { RouteCallsValidation } from '../route-calls.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('RouteCallsValidation', () => {
  let validation: RouteCallsValidation;
  let tokenConfigService: jest.Mocked<TokenConfigService>;

  beforeEach(async () => {
    const mockTokenConfigService = {
      getSupportedTokens: jest.fn(),
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
        RouteCallsValidation,
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

    validation = module.get<RouteCallsValidation>(RouteCallsValidation);
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

    const mockTokens = [
      {
        address: toUniversalAddress(
          '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        ), // USDC
        decimals: 6,
        limit: { max: 1000000 },
      },
      {
        address: toUniversalAddress(
          '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
        ), // USDT
        decimals: 6,
        limit: { max: 1000000 },
      },
    ];

    describe('no calls scenarios', () => {
      it('should return true when no calls exist', async () => {
        const intentWithNoCalls = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [],
          },
        });

        const result = await validation.validate(intentWithNoCalls, mockContext);

        expect(result).toBe(true);
        expect(tokenConfigService.getSupportedTokens).not.toHaveBeenCalled();
      });
    });

    describe('valid calls scenarios', () => {
      it('should return true for ERC20 transfer calls to supported token addresses', async () => {
        const intentWithValidTransferCalls = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC - supported token
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // transfer(address,uint256)
                value: BigInt(0),
              },
              {
                target: toUniversalAddress(
                  '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
                ), // USDT - supported token
                data: '0xa9059cbb00000000000000000000000098765432109876543210987654321098765432100000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // transfer(address,uint256)
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithValidTransferCalls, mockContext);

        expect(result).toBe(true);
        expect(tokenConfigService.getSupportedTokens).toHaveBeenCalledWith(BigInt(10));
      });
    });

    describe('invalid calls scenarios', () => {
      it('should throw error when call target is not a supported token address', async () => {
        const intentWithNonTokenCall = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000005555555555555555555555555555555555555555',
                ), // Not a supported token
                data: '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890' as `0x${string}`,
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        await expect(validation.validate(intentWithNonTokenCall, mockContext)).rejects.toThrow(
          'Invalid route call: target 0x0000000000000000000000005555555555555555555555555555555555555555 is not a supported token address on chain 10',
        );
      });

      it('should throw error for non-transfer ERC20 functions on supported tokens', async () => {
        const intentWithApprove = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC - supported token
                data: '0x095ea7b300000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // approve(address,uint256)
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        await expect(validation.validate(intentWithApprove, mockContext)).rejects.toThrow(
          'Invalid route call: unable to decode ERC20 call data for target 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });

      it('should throw error for transferFrom function', async () => {
        const intentWithTransferFrom = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC - supported token
                data: '0x23b872dd' as `0x${string}`, // transferFrom(address,address,uint256)
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        await expect(validation.validate(intentWithTransferFrom, mockContext)).rejects.toThrow(
          'Invalid route call: unable to decode ERC20 call data for target 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });

      it('should handle case-insensitive token address comparison', async () => {
        // Create mock tokens with lowercase address to match the test case
        const mockTokensWithLowercase = [
          {
            address: toUniversalAddress(
              '0x0000000000000000000000007f5c764cbc14f9669b88837ca1490cca17c31607',
            ), // lowercase USDC
            decimals: 6,
            limit: { max: 1000000 },
          },
          {
            address: toUniversalAddress(
              '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
            ), // USDT
            decimals: 6,
            limit: { max: 1000000 },
          },
        ];

        const intentWithLowercaseToken = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007f5c764cbc14f9669b88837ca1490cca17c31607',
                ), // lowercase USDC
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`,
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokensWithLowercase);

        const result = await validation.validate(intentWithLowercaseToken, mockContext);

        expect(result).toBe(true); // Should pass when addresses match exactly
      });

      it('should throw error when call data cannot be decoded as ERC20', async () => {
        const intentWithInvalidData = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC - supported token
                data: '0x' as `0x${string}`, // Empty data that cannot be decoded
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        await expect(validation.validate(intentWithInvalidData, mockContext)).rejects.toThrow(
          'Invalid route call: unable to decode ERC20 call data for target 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });

      it('should throw error for custom function selectors', async () => {
        const intentWithCustomFunction = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC - supported token
                data: '0x12345678' as `0x${string}`, // Custom function selector
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        await expect(validation.validate(intentWithCustomFunction, mockContext)).rejects.toThrow(
          'Invalid route call: unable to decode ERC20 call data for target 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });
    });

    describe('network configuration edge cases', () => {
      it('should throw error when call is to unsupported token even with no tokens configured', async () => {
        const intentWithNonTransferCall = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                data: '0x095ea7b300000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // approve - not transfer
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue([]);

        await expect(validation.validate(intentWithNonTransferCall, mockContext)).rejects.toThrow(
          'Invalid route call: unable to decode ERC20 call data for target 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });

      it('should pass validation when no tokens are configured (allows all)', async () => {
        const intentWithTransferCall = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ),
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // transfer
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue([]);

        const result = await validation.validate(intentWithTransferCall, mockContext);
        expect(result).toBe(true); // When no tokens configured, all calls are allowed
      });
    });

    describe('complex scenarios', () => {
      it('should throw error if any call in the array is invalid', async () => {
        const intentWithMixedCalls = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC - supported token
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // valid transfer
                value: BigInt(0),
              },
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000006666666666666666666666666666666666666666',
                ), // Not a supported token
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // transfer
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        await expect(validation.validate(intentWithMixedCalls, mockContext)).rejects.toThrow(
          'Invalid route call: target 0x0000000000000000000000006666666666666666666666666666666666666666 is not a supported token address on chain 10',
        );
      });

      it('should check both conditions (token address and transfer function)', async () => {
        const intentWithTokenTransfer = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // Token address
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // transfer function
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithTokenTransfer, mockContext);

        // Should pass both checks (is token address AND is transfer function)
        expect(result).toBe(true);
      });

      it('should validate all calls must be transfers to supported token addresses', async () => {
        const intentWithAllValidTransfers = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`,
                value: BigInt(0),
              },
              {
                target: toUniversalAddress(
                  '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
                ), // USDT
                data: '0xa9059cbb00000000000000000000000098765432109876543210987654321098765432100000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`,
                value: BigInt(0),
              },
              {
                target: toUniversalAddress(
                  '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
                ), // USDC again
                data: '0xa9059cbb00000000000000000000000055556666777788889999000011112222333344440000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`,
                value: BigInt(0),
              },
            ],
          },
        });

        tokenConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithAllValidTransfers, mockContext);

        expect(result).toBe(true);
      });
    });
  });
});
