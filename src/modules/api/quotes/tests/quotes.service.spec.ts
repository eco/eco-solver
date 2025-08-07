import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { QuoteResult } from '@/modules/fulfillment/interfaces/quote-result.interface';
import { FulfillmentStrategy } from '@/modules/fulfillment/strategies';

import { QuotesService } from '../quotes.service';
import { QuoteRequest } from '../schemas/quote-request.schema';

describe('QuotesService', () => {
  let service: QuotesService;

  const mockStrategy = {
    name: 'standard',
    canHandle: jest.fn(),
    getQuote: jest.fn(),
  };

  const mockFulfillmentService = {
    getStrategy: jest.fn(),
  };

  const mockFulfillmentConfigService = {
    defaultStrategy: 'standard',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        {
          provide: FulfillmentService,
          useValue: mockFulfillmentService,
        },
        {
          provide: FulfillmentConfigService,
          useValue: mockFulfillmentConfigService,
        },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQuote', () => {
    const mockIntentInput: QuoteRequest['intent'] = {
      reward: {
        prover: '0x1234567890123456789012345678901234567890',
        creator: '0x1234567890123456789012345678901234567890',
        deadline: BigInt('1735689600'),
        nativeValue: BigInt('1000000000000000000'),
        tokens: [
          {
            amount: BigInt('5000000000000000000'),
            token: '0x1234567890123456789012345678901234567890',
          },
        ],
      },
      route: {
        source: BigInt('1'),
        destination: BigInt('10'),
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
        inbox: '0x1234567890123456789012345678901234567890',
        calls: [
          {
            target: '0x1234567890123456789012345678901234567890',
            value: BigInt('0'),
            data: '0x',
          },
        ],
        tokens: [
          {
            amount: BigInt('5000000000000000000'),
            token: '0x1234567890123456789012345678901234567890',
          },
        ],
      },
    };

    it('should return a valid quote when strategy can handle intent', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: {
          baseFee: BigInt('1000000000000000'),
          percentageFee: BigInt('50000000000000'),
          totalRequiredFee: BigInt('1050000000000000'),
          currentReward: BigInt('5000000000000000000'),
          minimumRequiredReward: BigInt('1050000000000000'),
        },
        validationResults: [
          { validation: 'IntentFundedValidation', passed: true },
          { validation: 'StandardFeeValidation', passed: true },
        ],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      const result = await service.getQuote(mockIntentInput, 'standard');

      expect(result).toEqual({
        valid: true,
        strategy: 'standard',
        fees: {
          baseFee: '1000000000000000',
          percentageFee: '50000000000000',
          totalRequiredFee: '1050000000000000',
          currentReward: '5000000000000000000',
          minimumRequiredReward: '1050000000000000',
        },
        validations: {
          passed: ['IntentFundedValidation', 'StandardFeeValidation'],
          failed: [],
        },
      });

      expect(mockFulfillmentService.getStrategy).toHaveBeenCalledWith('standard');
      expect(mockStrategy.canHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          intentHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
        }),
      );
    });

    it('should use default strategy when none provided', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: undefined,
        validationResults: [],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      await service.getQuote(mockIntentInput);

      expect(mockFulfillmentService.getStrategy).toHaveBeenCalledWith('standard');
    });

    it('should throw BadRequestException when strategy not found', async () => {
      mockFulfillmentService.getStrategy.mockReturnValue(undefined);

      await expect(service.getQuote(mockIntentInput, 'unknown' as any)).rejects.toThrow(
        new BadRequestException('Unknown strategy: unknown'),
      );
    });

    it('should throw BadRequestException when strategy cannot handle intent', async () => {
      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(false);

      await expect(service.getQuote(mockIntentInput, 'standard')).rejects.toThrow(
        new BadRequestException('Strategy standard cannot handle this intent'),
      );
    });

    it('should return invalid quote with failed validations', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: false,
        strategy: 'standard',
        fees: {
          baseFee: BigInt('1000000000000000'),
          percentageFee: BigInt('50000000000000'),
          totalRequiredFee: BigInt('1050000000000000'),
          currentReward: BigInt('500000000000000'),
          minimumRequiredReward: BigInt('1050000000000000'),
        },
        validationResults: [
          { validation: 'IntentFundedValidation', passed: true },
          {
            validation: 'StandardFeeValidation',
            passed: false,
            error: 'Reward native value 500000000000000 is less than required fee 1050000000000000',
          },
        ],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      const result = await service.getQuote(mockIntentInput, 'standard');

      expect(result.valid).toBe(false);
      expect(result.validations.failed).toEqual([
        {
          validation: 'StandardFeeValidation',
          reason: 'Reward native value 500000000000000 is less than required fee 1050000000000000',
        },
      ]);
    });

    it('should handle quote result without fees', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: undefined,
        validationResults: [{ validation: 'ChainSupportValidation', passed: true }],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      const result = await service.getQuote(mockIntentInput, 'standard');

      expect(result.fees).toEqual({
        baseFee: '0',
        percentageFee: '0',
        totalRequiredFee: '0',
        currentReward: '0',
        minimumRequiredReward: '0',
      });
    });

    it('should generate consistent intent hash', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: undefined,
        validationResults: [],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      await service.getQuote(mockIntentInput, 'standard');

      const firstCallIntent = (mockStrategy.canHandle as jest.Mock).mock.calls[0][0] as Intent;

      await service.getQuote(mockIntentInput, 'standard');

      const secondCallIntent = (mockStrategy.canHandle as jest.Mock).mock.calls[1][0] as Intent;

      expect(firstCallIntent.intentHash).toBe(secondCallIntent.intentHash);
    });

    it('should properly convert intent input to Intent interface', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: undefined,
        validationResults: [],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      await service.getQuote(mockIntentInput, 'standard');

      expect(mockStrategy.canHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          intentHash: expect.any(String),
          reward: expect.objectContaining({
            prover: '0x1234567890123456789012345678901234567890',
            creator: '0x1234567890123456789012345678901234567890',
            deadline: BigInt('1735689600'),
            nativeValue: BigInt('1000000000000000000'),
          }),
          route: expect.objectContaining({
            source: BigInt('1'),
            destination: BigInt('10'),
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
            inbox: '0x1234567890123456789012345678901234567890',
          }),
        }),
      );
    });
  });
});
