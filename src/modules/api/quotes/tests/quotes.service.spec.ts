import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainConfigService, FulfillmentConfigService } from '@/modules/config/services';
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

  const mockBlockchainConfigService = {
    getPortalAddress: jest.fn().mockReturnValue('0x1234567890123456789012345678901234567890'),
    getProverAddress: jest.fn().mockReturnValue('0x1234567890123456789012345678901234567890'),
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
        {
          provide: BlockchainConfigService,
          useValue: mockBlockchainConfigService,
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
        nativeAmount: BigInt('1000000000000000000'),
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
        portal: '0x1234567890123456789012345678901234567890',
        nativeAmount: BigInt('0'),
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
        quoteResponse: {
          sourceChainID: 1,
          destinationChainID: 10,
          sourceToken: '0x0000000000000000000000001234567890123456789012345678901234567890',
          destinationToken: '0x0000000000000000000000001234567890123456789012345678901234567890',
          sourceAmount: '5000000000000000000',
          destinationAmount: '5000000000000000000',
          funder: '0x0000000000000000000000001234567890123456789012345678901234567890',
          refundRecipient: '0x0000000000000000000000001234567890123456789012345678901234567890',
          recipient: '0x0000000000000000000000001234567890123456789012345678901234567890',
          fees: [
            {
              name: 'Eco Protocol Fee',
              description: 'Protocol fee for fulfilling intent on chain 10',
              token: {
                address: '0x0000000000000000000000001234567890123456789012345678901234567890',
                decimals: 18,
                symbol: 'TOKEN',
              },
              amount: '1050000000000000',
            },
          ],
          deadline: 1735689600,
          estimatedFulfillTimeSec: 30,
        },
        contracts: {
          prover: '0x1234567890123456789012345678901234567890',
          portal: '0x1234567890123456789012345678901234567890',
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

    it('should throw BadRequestException with failed validations for invalid quote', async () => {
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
            error: 'Reward amount 500000000000000 is less than required fee 1050000000000000',
          },
        ],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      await expect(service.getQuote(mockIntentInput, 'standard')).rejects.toThrow(
        new BadRequestException({
          validations: {
            passed: ['IntentFundedValidation'],
            failed: [
              {
                validation: 'StandardFeeValidation',
                reason: 'Reward amount 500000000000000 is less than required fee 1050000000000000',
              },
            ],
          },
        }),
      );
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

      expect(result).toEqual({
        quoteResponse: {
          sourceChainID: 1,
          destinationChainID: 10,
          sourceToken: '0x0000000000000000000000001234567890123456789012345678901234567890',
          destinationToken: '0x0000000000000000000000001234567890123456789012345678901234567890',
          sourceAmount: '5000000000000000000',
          destinationAmount: '5000000000000000000',
          funder: '0x0000000000000000000000001234567890123456789012345678901234567890',
          refundRecipient: '0x0000000000000000000000001234567890123456789012345678901234567890',
          recipient: '0x0000000000000000000000001234567890123456789012345678901234567890',
          fees: [],
          deadline: 1735689600,
          estimatedFulfillTimeSec: 30,
        },
        contracts: {
          prover: '0x1234567890123456789012345678901234567890',
          portal: '0x1234567890123456789012345678901234567890',
        },
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
          destination: BigInt('10'),
          sourceChainId: BigInt('1'),
          reward: expect.objectContaining({
            prover: '0x0000000000000000000000001234567890123456789012345678901234567890',
            creator: '0x0000000000000000000000001234567890123456789012345678901234567890',
            deadline: BigInt('1735689600'),
            nativeAmount: BigInt('1000000000000000000'),
          }),
          route: expect.objectContaining({
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
            portal: '0x0000000000000000000000001234567890123456789012345678901234567890',
          }),
        }),
      );
    });
  });
});
