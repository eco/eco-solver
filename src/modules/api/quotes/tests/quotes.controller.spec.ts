import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { AppConfigService } from '@/modules/config/services/app-config.service';

import { QuotesController } from '../quotes.controller';
import { QuotesService } from '../quotes.service';
import { QuoteRequest } from '../schemas/quote-request.schema';
import { SuccessfulQuoteResponse } from '../schemas/quote-response.schema';

describe('QuotesController', () => {
  let controller: QuotesController;
  let quotesService: QuotesService;

  const mockQuotesService = {
    getQuote: jest.fn(),
  };

  const mockAppConfigService = {
    apiKeys: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        {
          provide: QuotesService,
          useValue: mockQuotesService,
        },
        {
          provide: AppConfigService,
          useValue: mockAppConfigService,
        },
        {
          provide: ApiKeyGuard,
          useValue: { canActivate: () => true }, // Mock ApiKeyGuard
        },
        {
          provide: ThrottlerGuard,
          useValue: { canActivate: () => true }, // Mock ThrottlerGuard
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<QuotesController>(QuotesController);
    quotesService = module.get<QuotesService>(QuotesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQuote', () => {
    it('should call quotesService.getQuote with intent and strategy', async () => {
      const mockRequest: QuoteRequest = {
        intent: {
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
        },
        strategy: 'standard',
      };

      const mockResponse: SuccessfulQuoteResponse = {
        quoteResponse: {
          sourceChainID: 1,
          destinationChainID: 10,
          sourceToken: '0x1234567890123456789012345678901234567890',
          destinationToken: '0x1234567890123456789012345678901234567890',
          sourceAmount: '5000000000000000000',
          destinationAmount: '5000000000000000000',
          funder: '0x1234567890123456789012345678901234567890',
          refundRecipient: '0x1234567890123456789012345678901234567890',
          recipient: '0x1234567890123456789012345678901234567890',
          fees: [
            {
              name: 'Eco Protocol Fee',
              description: 'Protocol fee for fulfilling intent on chain 10',
              token: {
                address: '0x1234567890123456789012345678901234567890',
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
      };

      mockQuotesService.getQuote.mockResolvedValue(mockResponse);

      const result = await controller.getQuote(mockRequest);

      expect(quotesService.getQuote).toHaveBeenCalledWith(mockRequest.intent, mockRequest.strategy);
      expect(result).toEqual(mockResponse);
    });

    it('should call quotesService.getQuote without strategy when not provided', async () => {
      const mockRequest: QuoteRequest = {
        intent: {
          reward: {
            prover: '0x1234567890123456789012345678901234567890',
            creator: '0x1234567890123456789012345678901234567890',
            deadline: BigInt('1735689600'),
            nativeAmount: BigInt('1000000000000000000'),
            tokens: [],
          },
          route: {
            source: BigInt('1'),
            destination: BigInt('10'),
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
            portal: '0x1234567890123456789012345678901234567890',
            nativeAmount: BigInt('0'),
            calls: [],
            tokens: [],
          },
        },
      };

      const mockResponse: SuccessfulQuoteResponse = {
        quoteResponse: {
          sourceChainID: 1,
          destinationChainID: 10,
          sourceToken: '0x0000000000000000000000000000000000000000',
          destinationToken: '0x0000000000000000000000000000000000000000',
          sourceAmount: '0',
          destinationAmount: '0',
          funder: '0x1234567890123456789012345678901234567890',
          refundRecipient: '0x1234567890123456789012345678901234567890',
          recipient: '0x1234567890123456789012345678901234567890',
          fees: [],
          deadline: 1735689600,
          estimatedFulfillTimeSec: 30,
        },
        contracts: {
          prover: '0x1234567890123456789012345678901234567890',
          portal: '0x1234567890123456789012345678901234567890',
        },
      };

      mockQuotesService.getQuote.mockResolvedValue(mockResponse);

      const result = await controller.getQuote(mockRequest);

      expect(quotesService.getQuote).toHaveBeenCalledWith(mockRequest.intent, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors from quotesService', async () => {
      const mockRequest: QuoteRequest = {
        intent: {
          reward: {
            prover: '0x1234567890123456789012345678901234567890',
            creator: '0x1234567890123456789012345678901234567890',
            deadline: BigInt('1735689600'),
            nativeAmount: BigInt('0'),
            tokens: [],
          },
          route: {
            source: BigInt('1'),
            destination: BigInt('10'),
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
            portal: '0x1234567890123456789012345678901234567890',
            nativeAmount: BigInt('0'),
            calls: [],
            tokens: [],
          },
        },
        strategy: 'invalid-strategy' as any,
      };

      const error = new Error('Unknown strategy: invalid-strategy');
      mockQuotesService.getQuote.mockRejectedValue(error);

      await expect(controller.getQuote(mockRequest)).rejects.toThrow(error);
    });
  });
});
