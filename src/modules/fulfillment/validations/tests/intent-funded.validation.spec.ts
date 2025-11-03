import { Test } from '@nestjs/testing';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { Logger } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

// Mock the blockchain reader service module before any imports
jest.mock('@/modules/blockchain/blockchain-reader.service', () => ({
  BlockchainReaderService: jest.fn().mockImplementation(() => ({
    isIntentFunded: jest.fn(),
  })),
}));

import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';

import { IntentFundedValidation } from '../intent-funded.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

// Helper function to create UniversalAddress from string
function toUniversalAddress(address: string): UniversalAddress {
  return address as UniversalAddress;
}

describe('IntentFundedValidation', () => {
  let validation: IntentFundedValidation;
  let blockchainReaderService: jest.Mocked<BlockchainReaderService>;

  beforeEach(async () => {
    const mockBlockchainReaderService = {
      isIntentFunded: jest.fn(),
    };

    const mockLoggerService = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      verbose: jest.fn(),
      fatal: jest.fn(),
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
        IntentFundedValidation,
        {
          provide: BlockchainReaderService,
          useValue: mockBlockchainReaderService,
        },
        {
          provide: Logger,
          useValue: mockLoggerService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<IntentFundedValidation>(IntentFundedValidation);
    blockchainReaderService = module.get(BlockchainReaderService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    it('should return true when intent is funded', async () => {
      blockchainReaderService.isIntentFunded.mockResolvedValue(true);

      const result = await validation.validate(mockIntent, mockContext);

      expect(result).toBe(true);
      expect(blockchainReaderService.isIntentFunded).toHaveBeenCalledWith(
        mockIntent.sourceChainId,
        mockIntent,
      );
    });

    it('should throw error when intent is not funded', async () => {
      blockchainReaderService.isIntentFunded.mockResolvedValue(false);

      await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
        `Intent ${mockIntent.intentHash} is not funded on chain ${mockIntent.sourceChainId}`,
      );
      expect(blockchainReaderService.isIntentFunded).toHaveBeenCalledWith(
        mockIntent.sourceChainId,
        mockIntent,
      );
    });

    it('should propagate errors from blockchain reader service', async () => {
      const error = new Error('Blockchain connection failed');
      blockchainReaderService.isIntentFunded.mockRejectedValue(error);

      await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
        'Failed to verify intent funding status: Blockchain connection failed',
      );
      expect(blockchainReaderService.isIntentFunded).toHaveBeenCalledWith(
        mockIntent.sourceChainId,
        mockIntent,
      );
    });

    it('should handle different intent configurations', async () => {
      const intentsWithTokens = createMockIntent({
        reward: {
          ...mockIntent.reward,
          tokens: [
            {
              token: toUniversalAddress(
                '0x0000000000000000000000001111111111111111111111111111111111111111',
              ),
              amount: BigInt(500),
            },
            {
              token: toUniversalAddress(
                '0x0000000000000000000000002222222222222222222222222222222222222222',
              ),
              amount: BigInt(1000),
            },
          ],
        },
        route: {
          ...mockIntent.route,
          tokens: [
            {
              token: toUniversalAddress(
                '0x0000000000000000000000003333333333333333333333333333333333333333',
              ),
              amount: BigInt(2000),
            },
          ],
          calls: [
            {
              target: toUniversalAddress(
                '0x0000000000000000000000004444444444444444444444444444444444444444',
              ),
              data: '0x' as `0x${string}`,
              value: BigInt(0),
            },
          ],
        },
      });

      blockchainReaderService.isIntentFunded.mockResolvedValue(true);

      const result = await validation.validate(intentsWithTokens, mockContext);

      expect(result).toBe(true);
      expect(blockchainReaderService.isIntentFunded).toHaveBeenCalledWith(
        intentsWithTokens.sourceChainId,
        intentsWithTokens,
      );
    });
  });
});
