import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AppConfigService } from '@/modules/config/services/app-config.service';

import { QuotesController } from '../controllers/quotes.controller';
import { QuoteRequest } from '../schemas/quote-request.schema';
import { SuccessfulQuoteResponse } from '../schemas/quote-response.schema';
import { QuotesService } from '../services/quotes.service';

describe('QuotesController', () => {
  let controller: QuotesController;
  let quotesService: QuotesService;

  const mockQuotesService = {
    getQuote: jest.fn(),
  };

  const mockAppConfigService = {};

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
          provide: ThrottlerGuard,
          useValue: { canActivate: () => true }, // Mock ThrottlerGuard
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<QuotesController>(QuotesController);
    quotesService = module.get<QuotesService>(QuotesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQuote', () => {
    it('should call quotesService.getQuote with the request', async () => {
      const mockRequest: QuoteRequest = {
        dAppID: 'test-dapp',
        quoteRequest: {
          sourceChainID: 1n,
          destinationChainID: 10n,
          sourceToken: '0x1234567890123456789012345678901234567890',
          destinationToken: '0x1234567890123456789012345678901234567890',
          sourceAmount: 5000000000000000000n,
          funder: '0x1234567890123456789012345678901234567890',
          recipient: '0x1234567890123456789012345678901234567890',
        },
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
          encodedRoute: '0x',
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
          sourcePortal: '0x1234567890123456789012345678901234567890',
          destinationPortal: '0x1234567890123456789012345678901234567890',
        },
      };

      mockQuotesService.getQuote.mockResolvedValue(mockResponse);

      const result = await controller.getQuote(mockRequest);

      expect(quotesService.getQuote).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should handle minimal request with only required fields', async () => {
      const mockRequest: QuoteRequest = {
        dAppID: 'minimal-dapp',
        quoteRequest: {
          sourceChainID: 1n,
          destinationChainID: 10n,
          sourceToken: '0x0000000000000000000000000000000000000000',
          destinationToken: '0x0000000000000000000000000000000000000000',
          sourceAmount: 1000000000000000000n,
          funder: '0x1234567890123456789012345678901234567890',
          recipient: '0x1234567890123456789012345678901234567890',
        },
      };

      const mockResponse: SuccessfulQuoteResponse = {
        quoteResponse: {
          sourceChainID: 1,
          destinationChainID: 10,
          sourceToken: '0x0000000000000000000000000000000000000000',
          destinationToken: '0x0000000000000000000000000000000000000000',
          sourceAmount: '1000000000000000000',
          destinationAmount: '1000000000000000000',
          funder: '0x1234567890123456789012345678901234567890',
          refundRecipient: '0x1234567890123456789012345678901234567890',
          recipient: '0x1234567890123456789012345678901234567890',
          encodedRoute: '0x',
          fees: [],
          deadline: 1735689600,
          estimatedFulfillTimeSec: 30,
        },
        contracts: {
          prover: '0x1234567890123456789012345678901234567890',
          sourcePortal: '0x1234567890123456789012345678901234567890',
          destinationPortal: '0x1234567890123456789012345678901234567890',
        },
      };

      mockQuotesService.getQuote.mockResolvedValue(mockResponse);

      const result = await controller.getQuote(mockRequest);

      expect(quotesService.getQuote).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors from quotesService', async () => {
      const mockRequest: QuoteRequest = {
        dAppID: 'error-dapp',
        quoteRequest: {
          sourceChainID: 999n,
          destinationChainID: 999n,
          sourceToken: '0x1234567890123456789012345678901234567890',
          destinationToken: '0x1234567890123456789012345678901234567890',
          sourceAmount: 1000000000000000000n,
          funder: '0x1234567890123456789012345678901234567890',
          recipient: '0x1234567890123456789012345678901234567890',
        },
      };

      const error = new Error('Portal address not configured for chain 999');
      mockQuotesService.getQuote.mockRejectedValue(error);

      await expect(controller.getQuote(mockRequest)).rejects.toThrow(error);
    });
  });
});
