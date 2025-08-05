import { Test } from '@nestjs/testing';

import { Address } from 'viem';

import { EvmConfigService } from '@/modules/config/services/evm-config.service';

import { RouteCallsValidation } from '../route-calls.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('RouteCallsValidation', () => {
  let validation: RouteCallsValidation;
  let evmConfigService: jest.Mocked<EvmConfigService>;

  beforeEach(async () => {
    const mockEvmConfigService = {
      getSupportedTokens: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        RouteCallsValidation,
        {
          provide: EvmConfigService,
          useValue: mockEvmConfigService,
        },
      ],
    }).compile();

    validation = module.get<RouteCallsValidation>(RouteCallsValidation);
    evmConfigService = module.get(EvmConfigService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent({
      reward: {
        ...createMockIntent().reward,
        nativeValue: BigInt(0),
      },
    });
    const mockContext = createMockValidationContext();

    const mockTokens = [
      {
        address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC
        decimals: 6,
        limit: 1000000,
      },
      {
        address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
        decimals: 6,
        limit: 1000000,
      },
    ];

    describe('no calls scenarios', () => {
      it('should return true when no calls exist', async () => {
        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
        expect(evmConfigService.getSupportedTokens).not.toHaveBeenCalled();
      });
    });

    describe('valid calls scenarios', () => {
      it('should return true only for ERC20 transfer calls to non-token addresses', async () => {
        const intentWithValidTransferCalls = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // transfer(address,uint256)
                value: BigInt(0),
              },
              {
                target: '0x6666666666666666666666666666666666666666' as Address,
                data: '0xa9059cbb00000000000000000000000098765432109876543210987654321098765432100000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // transfer(address,uint256)
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithValidTransferCalls, mockContext);

        expect(result).toBe(true);
        expect(evmConfigService.getSupportedTokens).toHaveBeenCalledWith(10n);
      });
    });

    describe('invalid calls scenarios', () => {
      it('should return false when call target is a supported token address', async () => {
        const intentWithTokenCall = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address, // USDC on destination
                data: '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890' as `0x${string}`,
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithTokenCall, mockContext);

        expect(result).toBe(false);
      });

      it('should return false for non-transfer ERC20 functions', async () => {
        const intentWithApprove = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0x095ea7b30000000000000000000000001234567890123456789012345678901234567890' as `0x${string}`, // approve(address,uint256)
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithApprove, mockContext);

        expect(result).toBe(false);
      });

      it('should return false for transferFrom function', async () => {
        const intentWithTransferFrom = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0x23b872dd' as `0x${string}`, // transferFrom(address,address,uint256)
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithTransferFrom, mockContext);

        expect(result).toBe(false);
      });

      it('should handle case-insensitive token address comparison', async () => {
        const intentWithLowercaseToken = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x7f5c764cbc14f9669b88837ca1490cca17c31607' as Address, // lowercase USDC
                data: '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890' as `0x${string}`,
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithLowercaseToken, mockContext);

        expect(result).toBe(false);
      });

      it('should return false when call data cannot be decoded as ERC20', async () => {
        const intentWithInvalidData = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0x' as `0x${string}`, // Empty data that cannot be decoded
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithInvalidData, mockContext);

        expect(result).toBe(false);
      });

      it('should return false for custom function selectors', async () => {
        const intentWithCustomFunction = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0x12345678' as `0x${string}`, // Custom function selector
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithCustomFunction, mockContext);

        expect(result).toBe(false);
      });
    });

    describe('network configuration edge cases', () => {
      it('should still validate calls even when network has no supported tokens', async () => {
        const intentWithNonTransferCall = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                data: '0x095ea7b3' as `0x${string}`, // approve - not transfer
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue([]);

        const result = await validation.validate(intentWithNonTransferCall, mockContext);

        expect(result).toBe(false); // Still fails because it's not a transfer function
      });

      it('should allow transfer calls when no tokens are configured', async () => {
        const intentWithTransferCall = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`, // transfer
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue([]);

        const result = await validation.validate(intentWithTransferCall, mockContext);

        expect(result).toBe(true); // Passes because it's a transfer and not in token list
      });
    });

    describe('complex scenarios', () => {
      it('should return false if any call in the array is invalid', async () => {
        const intentWithMixedCalls = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x5555555555555555555555555555555555555555' as Address,
                data: '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890' as `0x${string}`, // valid transfer
                value: BigInt(0),
              },
              {
                target: '0x6666666666666666666666666666666666666666' as Address,
                data: '0x095ea7b3' as `0x${string}`, // approve - invalid
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithMixedCalls, mockContext);

        expect(result).toBe(false);
      });

      it('should check both conditions (token address and transfer function)', async () => {
        const intentWithTokenTransfer = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address, // Token address
                data: '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890' as `0x${string}`, // transfer function
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithTokenTransfer, mockContext);

        // Should fail on first check (token address)
        expect(result).toBe(false);
      });

      it('should validate all calls must be transfers to non-token addresses', async () => {
        const intentWithAllValidTransfers = createMockIntent({
          route: {
            ...mockIntent.route,
            calls: [
              {
                target: '0x1111111111111111111111111111111111111111' as Address,
                data: '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`,
                value: BigInt(0),
              },
              {
                target: '0x2222222222222222222222222222222222222222' as Address,
                data: '0xa9059cbb00000000000000000000000098765432109876543210987654321098765432100000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`,
                value: BigInt(0),
              },
              {
                target: '0x3333333333333333333333333333333333333333' as Address,
                data: '0xa9059cbb00000000000000000000000055556666777788889999000011112222333344440000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`,
                value: BigInt(0),
              },
            ],
          },
        });

        evmConfigService.getSupportedTokens.mockReturnValue(mockTokens);

        const result = await validation.validate(intentWithAllValidTransfers, mockContext);

        expect(result).toBe(true);
      });
    });
  });
});
