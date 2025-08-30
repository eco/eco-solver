import { Test } from '@nestjs/testing';

import { Address } from 'viem';

import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { IntentFundedValidation } from '../intent-funded.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

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
        IntentFundedValidation,
        {
          provide: BlockchainReaderService,
          useValue: mockBlockchainReaderService,
        },
        {
          provide: SystemLoggerService,
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
            { token: '0x1111111111111111111111111111111111111111' as Address, amount: BigInt(500) },
            {
              token: '0x2222222222222222222222222222222222222222' as Address,
              amount: BigInt(1000),
            },
          ],
        },
        route: {
          ...mockIntent.route,
          tokens: [
            {
              token: '0x3333333333333333333333333333333333333333' as Address,
              amount: BigInt(2000),
            },
          ],
          calls: [
            {
              target: '0x4444444444444444444444444444444444444444' as Address,
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
