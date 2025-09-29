import { Test } from '@nestjs/testing';

import { toUniversalAddress } from '@/common/types/universal-address.type';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { ExecutorBalanceValidation } from '../executor-balance.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('ExecutorBalanceValidation', () => {
  let validation: ExecutorBalanceValidation;

  beforeEach(async () => {
    const mockBlockchainReaderService = {
      // Not used in this validation
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
        ExecutorBalanceValidation,
        {
          provide: BlockchainReaderService,
          useValue: mockBlockchainReaderService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<ExecutorBalanceValidation>(ExecutorBalanceValidation);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent({
      destination: BigInt(10),
      route: {
        ...createMockIntent().route,
        tokens: [
          {
            token: toUniversalAddress(
              '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
            ), // USDC
            amount: BigInt(1000000), // 1 USDC
          },
          {
            token: toUniversalAddress(
              '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
            ), // USDT
            amount: BigInt(2000000), // 2 USDT
          },
        ],
      },
    });

    describe('sufficient balance', () => {
      it('should return true when executor has sufficient balance for all tokens', async () => {
        const mockContext = createMockValidationContext({
          getWalletBalance: jest
            .fn()
            .mockResolvedValueOnce(BigInt(5000000)) // 5 USDC
            .mockResolvedValueOnce(BigInt(3000000)), // 3 USDT
        });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
        expect(mockContext.getWalletBalance).toHaveBeenCalledWith(
          mockIntent.destination,
          '0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
        expect(mockContext.getWalletBalance).toHaveBeenCalledWith(
          mockIntent.destination,
          '0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
        );
      });

      it('should return true when executor has exact balance needed', async () => {
        const mockContext = createMockValidationContext({
          getWalletBalance: jest
            .fn()
            .mockResolvedValueOnce(BigInt(1000000)) // Exactly 1 USDC
            .mockResolvedValueOnce(BigInt(2000000)), // Exactly 2 USDT
        });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should return true when no tokens are required', async () => {
        const intentWithNoTokens = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [],
          },
        });
        const mockContext = createMockValidationContext();

        const result = await validation.validate(intentWithNoTokens, mockContext);

        expect(result).toBe(true);
        expect(mockContext.getWalletBalance).not.toHaveBeenCalled();
      });
    });

    describe('insufficient balance', () => {
      it('should throw error when executor has insufficient balance for one token', async () => {
        const mockContext = createMockValidationContext({
          getWalletBalance: jest
            .fn()
            .mockResolvedValueOnce(BigInt(500000)) // Only 0.5 USDC
            .mockResolvedValueOnce(BigInt(3000000)), // 3 USDT
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Not enough token balance found for: 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });

      it('should throw error listing all tokens with insufficient balance', async () => {
        const mockContext = createMockValidationContext({
          getWalletBalance: jest
            .fn()
            .mockResolvedValueOnce(BigInt(500000)) // Only 0.5 USDC
            .mockResolvedValueOnce(BigInt(1000000)), // Only 1 USDT
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Not enough token balance found for: 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607, 0x00000000000000000000000094b008aA00579c1307B0EF2c499aD98a8ce58e58',
        );
      });

      it('should throw error when balance is 1 wei short', async () => {
        const mockContext = createMockValidationContext({
          getWalletBalance: jest
            .fn()
            .mockResolvedValueOnce(BigInt(999999)) // 1 wei short
            .mockResolvedValueOnce(BigInt(2000000)), // Exactly 2 USDT
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Not enough token balance found for: 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });

      it('should throw error when executor has zero balance', async () => {
        const mockContext = createMockValidationContext({
          getWalletBalance: jest
            .fn()
            .mockResolvedValueOnce(BigInt(0)) // Zero balance
            .mockResolvedValueOnce(BigInt(2000000)), // 2 USDT
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Not enough token balance found for: 0x0000000000000000000000007F5c764cBc14f9669B88837ca1490cCa17c31607',
        );
      });
    });

    describe('multiple tokens', () => {
      it('should check all tokens in parallel', async () => {
        const intentWithManyTokens = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(100),
              },
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000002222222222222222222222222222222222222222',
                ),
                amount: BigInt(200),
              },
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000003333333333333333333333333333333333333333',
                ),
                amount: BigInt(300),
              },
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000004444444444444444444444444444444444444444',
                ),
                amount: BigInt(400),
              },
            ],
          },
        });

        const mockContext = createMockValidationContext({
          getWalletBalance: jest.fn().mockResolvedValue(BigInt(1000)), // All have sufficient balance
        });

        const result = await validation.validate(intentWithManyTokens, mockContext);

        expect(result).toBe(true);
        expect(mockContext.getWalletBalance).toHaveBeenCalledTimes(4);
      });

      it('should check balance on the correct destination chain', async () => {
        const intentWithSpecificChain = createMockIntent({
          destination: BigInt(137), // Polygon
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(100),
              },
            ],
          },
        });

        const mockContext = createMockValidationContext({
          getWalletBalance: jest.fn().mockResolvedValue(BigInt(1000)),
        });

        await validation.validate(intentWithSpecificChain, mockContext);

        expect(mockContext.getWalletBalance).toHaveBeenCalledWith(
          intentWithSpecificChain.destination,
          '0x0000000000000000000000001111111111111111111111111111111111111111',
        );
      });
    });

    describe('edge cases', () => {
      it('should handle very large token amounts', async () => {
        const intentWithLargeAmounts = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt('1000000000000000000000000'), // Very large amount
              },
            ],
          },
        });

        const mockContext = createMockValidationContext({
          getWalletBalance: jest.fn().mockResolvedValue(BigInt('2000000000000000000000000')), // Even larger balance
        });

        const result = await validation.validate(intentWithLargeAmounts, mockContext);

        expect(result).toBe(true);
      });

      it('should handle duplicate token addresses', async () => {
        const intentWithDuplicates = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(100),
              },
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000001111111111111111111111111111111111111111',
                ),
                amount: BigInt(200),
              },
            ],
          },
        });

        const mockContext = createMockValidationContext({
          getWalletBalance: jest.fn().mockResolvedValue(BigInt(1000)), // Same balance returned for both calls
        });

        const result = await validation.validate(intentWithDuplicates, mockContext);

        expect(result).toBe(true);
        expect(mockContext.getWalletBalance).toHaveBeenCalledTimes(2);
      });

      it('should handle case-insensitive token addresses', async () => {
        const intentWithMixedCase = createMockIntent({
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: toUniversalAddress(
                  '0x0000000000000000000000007f5c764cbc14f9669b88837ca1490cca17c31607',
                ), // lowercase
                amount: BigInt(1000000),
              },
            ],
          },
        });

        const mockContext = createMockValidationContext({
          getWalletBalance: jest.fn().mockResolvedValue(BigInt(2000000)),
        });

        const result = await validation.validate(intentWithMixedCase, mockContext);

        expect(result).toBe(true);
        expect(mockContext.getWalletBalance).toHaveBeenCalledWith(
          mockIntent.destination,
          '0x0000000000000000000000007f5c764cbc14f9669b88837ca1490cca17c31607',
        );
      });
    });

    describe('error handling', () => {
      it('should propagate errors from context.getWalletBalance', async () => {
        const mockContext = createMockValidationContext({
          getWalletBalance: jest.fn().mockRejectedValue(new Error('Failed to fetch balance')),
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Failed to fetch balance',
        );
      });

      it('should handle network errors gracefully', async () => {
        const mockContext = createMockValidationContext({
          getWalletBalance: jest
            .fn()
            .mockResolvedValueOnce(BigInt(5000000))
            .mockRejectedValueOnce(new Error('Network timeout')),
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Network timeout',
        );
      });
    });
  });
});
