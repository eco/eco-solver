import { Test } from '@nestjs/testing';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { DuplicateRewardTokensValidation } from '../duplicate-reward-tokens.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('DuplicateRewardTokensValidation', () => {
  let validation: DuplicateRewardTokensValidation;

  beforeEach(async () => {
    const mockOtelService = {
      tracer: {
        startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
          const span = {
            setAttribute: jest.fn(),
            setAttributes: jest.fn(),
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
        DuplicateRewardTokensValidation,
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<DuplicateRewardTokensValidation>(DuplicateRewardTokensValidation);
  });

  describe('validate', () => {
    const mockContext = createMockValidationContext();

    it('should return true when there are no reward tokens', async () => {
      const intent = createMockIntent({
        reward: {
          ...createMockIntent().reward,
          tokens: [],
        },
      });

      const result = await validation.validate(intent, mockContext);

      expect(result).toBe(true);
    });

    it('should return true when there is only one reward token', async () => {
      const intent = createMockIntent({
        reward: {
          ...createMockIntent().reward,
          tokens: [
            {
              amount: BigInt(1000000000000000000),
              token:
                '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress,
            },
          ],
        },
      });

      const result = await validation.validate(intent, mockContext);

      expect(result).toBe(true);
    });

    it('should return true when all reward tokens have unique addresses', async () => {
      const intent = createMockIntent({
        reward: {
          ...createMockIntent().reward,
          tokens: [
            {
              amount: BigInt(1000000000000000000),
              token:
                '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress,
            },
            {
              amount: BigInt(2000000000000000000),
              token:
                '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd' as UniversalAddress,
            },
            {
              amount: BigInt(3000000000000000000),
              token:
                '0x0000000000000000000000009876543210987654321098765432109876543210' as UniversalAddress,
            },
          ],
        },
      });

      const result = await validation.validate(intent, mockContext);

      expect(result).toBe(true);
    });

    it('should throw error when there are duplicate token addresses', async () => {
      const duplicateToken =
        '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress;
      const intent = createMockIntent({
        reward: {
          ...createMockIntent().reward,
          tokens: [
            {
              amount: BigInt(1000000000000000000),
              token: duplicateToken,
            },
            {
              amount: BigInt(2000000000000000000),
              token:
                '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd' as UniversalAddress,
            },
            {
              amount: BigInt(3000000000000000000),
              token: duplicateToken,
            },
          ],
        },
      });

      await expect(validation.validate(intent, mockContext)).rejects.toThrow(
        `Duplicate reward tokens found: ${duplicateToken.toLowerCase()}. Each token address must be unique.`,
      );
    });

    it('should handle case-insensitive comparison for token addresses', async () => {
      const intent = createMockIntent({
        reward: {
          ...createMockIntent().reward,
          tokens: [
            {
              amount: BigInt(1000000000000000000),
              token:
                '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress,
            },
            {
              amount: BigInt(2000000000000000000),
              token:
                '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress, // Same address, different case
            },
          ],
        },
      });

      await expect(validation.validate(intent, mockContext)).rejects.toThrow(
        'Duplicate reward tokens found: 0x0000000000000000000000001234567890123456789012345678901234567890. Each token address must be unique.',
      );
    });

    it('should throw error with multiple duplicate tokens', async () => {
      const duplicateToken1 =
        '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress;
      const duplicateToken2 =
        '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd' as UniversalAddress;
      const intent = createMockIntent({
        reward: {
          ...createMockIntent().reward,
          tokens: [
            {
              amount: BigInt(1000000000000000000),
              token: duplicateToken1,
            },
            {
              amount: BigInt(2000000000000000000),
              token: duplicateToken2,
            },
            {
              amount: BigInt(3000000000000000000),
              token: duplicateToken1,
            },
            {
              amount: BigInt(4000000000000000000),
              token: duplicateToken2,
            },
          ],
        },
      });

      await expect(validation.validate(intent, mockContext)).rejects.toThrow(
        new RegExp(
          `Duplicate reward tokens found: (${duplicateToken1.toLowerCase()}|${duplicateToken2.toLowerCase()}), (${duplicateToken1.toLowerCase()}|${duplicateToken2.toLowerCase()}). Each token address must be unique.`,
        ),
      );
    });

    it('should allow same token amounts with different addresses', async () => {
      const intent = createMockIntent({
        reward: {
          ...createMockIntent().reward,
          tokens: [
            {
              amount: BigInt(1000000000000000000), // Same amount
              token:
                '0x0000000000000000000000001234567890123456789012345678901234567890' as UniversalAddress,
            },
            {
              amount: BigInt(1000000000000000000), // Same amount
              token:
                '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd' as UniversalAddress,
            },
          ],
        },
      });

      const result = await validation.validate(intent, mockContext);

      expect(result).toBe(true);
    });

    it('should handle many tokens with one duplicate', async () => {
      const duplicateToken =
        '0x0000000000000000000000005555555555555555555555555555555555555555' as UniversalAddress;
      const tokens = [];

      // Add 10 unique tokens
      for (let i = 0; i < 10; i++) {
        tokens.push({
          amount: BigInt(1000000000000000000 * (i + 1)),
          token: `0x000000000000000000000000${i.toString().padStart(40, '0')}` as UniversalAddress,
        });
      }

      // Add a duplicate
      tokens.push({
        amount: BigInt(11000000000000000000),
        token: duplicateToken,
      });

      // Add more unique tokens
      for (let i = 10; i < 20; i++) {
        tokens.push({
          amount: BigInt(1000000000000000000 * (i + 1)),
          token: `0x000000000000000000000000${i.toString().padStart(40, '0')}` as UniversalAddress,
        });
      }

      // Add the duplicate again
      tokens.push({
        amount: BigInt(21000000000000000000),
        token: duplicateToken,
      });

      const intent = createMockIntent({
        reward: {
          ...createMockIntent().reward,
          tokens,
        },
      });

      await expect(validation.validate(intent, mockContext)).rejects.toThrow(
        `Duplicate reward tokens found: ${duplicateToken.toLowerCase()}. Each token address must be unique.`,
      );
    });
  });
});
