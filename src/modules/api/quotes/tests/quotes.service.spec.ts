import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { BlockchainConfigService, FulfillmentConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { QuoteResult } from '@/modules/fulfillment/interfaces/quote-result.interface';
import { FulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { QuoteRepository } from '@/modules/intents/repositories/quote.repository';

import { QuoteRequest } from '../schemas/quote-request.schema';
import { QuotesService } from '../services/quotes.service';

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
    getPortalAddress: jest
      .fn()
      .mockReturnValue('0x0000000000000000000000001234567890123456789012345678901234567890'),
    getProverAddress: jest
      .fn()
      .mockReturnValue('0x0000000000000000000000001234567890123456789012345678901234567890'),
    getDefaultProver: jest.fn().mockReturnValue('hyper'),
    getTokenConfig: jest.fn().mockReturnValue({
      symbol: 'TEST',
      decimals: 18,
    }),
    getFeeLogic: jest.fn().mockReturnValue({
      tokens: {
        flatFee: 0.001,
        scalarBps: 0.1,
      },
    }),
  };

  const mockBlockchainReaderService = {
    buildTokenTransferCalldata: jest.fn().mockReturnValue({
      target: '0x1234567890123456789012345678901234567890',
      data: '0x',
      value: 0n,
    }),
  };

  const mockQuoteRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
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
        {
          provide: BlockchainReaderService,
          useValue: mockBlockchainReaderService,
        },
        {
          provide: QuoteRepository,
          useValue: mockQuoteRepository,
        },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);

    // Reset mocks to ensure getProverAddress, getPortalAddress and getDefaultProver return expected values
    mockBlockchainConfigService.getPortalAddress.mockReturnValue(
      '0x0000000000000000000000001234567890123456789012345678901234567890',
    );
    mockBlockchainConfigService.getProverAddress.mockReturnValue(
      '0x0000000000000000000000001234567890123456789012345678901234567890',
    );
    mockBlockchainConfigService.getDefaultProver.mockReturnValue('hyper');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQuote', () => {
    const mockQuoteRequest: QuoteRequest = {
      dAppID: 'test-dapp',
      quoteRequest: {
        sourceChainID: BigInt(1),
        destinationChainID: BigInt(10),
        sourceToken: '0x1234567890123456789012345678901234567890',
        destinationToken: '0x1234567890123456789012345678901234567890',
        sourceAmount: BigInt('5000000000000000000'),
        funder: '0x1234567890123456789012345678901234567890',
        recipient: '0x1234567890123456789012345678901234567890',
      },
    };

    it('should return a valid quote when strategy can handle intent', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: {
          reward: {
            native: 0n,
            tokens: BigInt('5000000000000000000'),
          },
          route: {
            native: 0n,
            tokens: BigInt('1000000000000000'),
            maximum: {
              native: 0n,
              tokens: BigInt('4998995000000000000'),
            },
          },
          fee: {
            base: BigInt('1000000000000000'),
            percentage: BigInt('5000000000000000'),
            total: BigInt('1005000000000000'),
            bps: 0.1,
          },
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

      const result = await service.getQuote(mockQuoteRequest);

      expect(result).toEqual({
        quoteResponses: [
          {
            intentExecutionType: 'SELF_PUBLISH',
            sourceChainID: 1,
            destinationChainID: 10,
            sourceToken: '0x1234567890123456789012345678901234567890',
            destinationToken: '0x1234567890123456789012345678901234567890',
            sourceAmount: '5000000000000000000',
            destinationAmount: '4998995000000000000',
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
                  symbol: 'TEST',
                },
                amount: '1005000000000000',
              },
            ],
            deadline: expect.any(Number),
            estimatedFulfillTimeSec: 30,
            encodedRoute: expect.any(String),
          },
        ],
        contracts: {
          sourcePortal: '0x1234567890123456789012345678901234567890',
          destinationPortal: '0x1234567890123456789012345678901234567890',
          prover: '0x1234567890123456789012345678901234567890',
        },
      });

      expect(mockFulfillmentService.getStrategy).toHaveBeenCalledWith('standard');
      expect(mockStrategy.canHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          intentHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
        }),
      );
    });

    it('should always use default strategy', async () => {
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

      await expect(service.getQuote(mockQuoteRequest)).rejects.toThrow(
        new BadRequestException('Quote validation failed: fees not available'),
      );

      expect(mockFulfillmentService.getStrategy).toHaveBeenCalledWith('standard');
    });

    it('should throw BadRequestException when default strategy not found', async () => {
      mockFulfillmentService.getStrategy.mockReturnValue(undefined);

      await expect(service.getQuote(mockQuoteRequest)).rejects.toThrow(
        new BadRequestException('Unknown strategy: standard'),
      );
    });

    it('should throw BadRequestException when strategy cannot handle intent', async () => {
      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(false);

      await expect(service.getQuote(mockQuoteRequest)).rejects.toThrow(
        new BadRequestException('Strategy standard cannot handle this intent'),
      );
    });

    it('should throw BadRequestException when no portal address configured', async () => {
      mockBlockchainConfigService.getPortalAddress.mockReturnValue(undefined);

      await expect(service.getQuote(mockQuoteRequest)).rejects.toThrow(
        new BadRequestException('Portal address not configured for chain 10'),
      );
    });

    it('should throw BadRequestException when no prover address configured', async () => {
      mockBlockchainConfigService.getProverAddress.mockReturnValue(undefined);

      await expect(service.getQuote(mockQuoteRequest)).rejects.toThrow(
        new BadRequestException('Default prover hyper not configured for chain 1'),
      );
    });

    it('should throw BadRequestException with failed validations for invalid quote', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: false,
        strategy: 'standard',
        fees: {
          reward: {
            native: 0n,
            tokens: BigInt('500000000000000'),
          },
          route: {
            native: 0n,
            tokens: BigInt('1000000000000000'),
            maximum: {
              native: 0n,
              tokens: BigInt('499949950000000'),
            },
          },
          fee: {
            base: BigInt('1000000000000000'),
            percentage: BigInt('50000000000'),
            total: BigInt('1000050000000'),
            bps: 0.1,
          },
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

      await expect(service.getQuote(mockQuoteRequest)).rejects.toThrow(
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

      await expect(service.getQuote(mockQuoteRequest)).rejects.toThrow(
        new BadRequestException('Quote validation failed: fees not available'),
      );
    });

    it('should throw BadRequestException when intent sourceChainId is missing', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: {
          reward: {
            native: 0n,
            tokens: BigInt('5000000000000000000'),
          },
          route: {
            native: 0n,
            tokens: BigInt('1000000000000000'),
            maximum: {
              native: 0n,
              tokens: BigInt('4998995000000000000'),
            },
          },
          fee: {
            base: BigInt('1000000000000000'),
            percentage: BigInt('5000000000000000'),
            total: BigInt('1005000000000000'),
            bps: 0.1,
          },
        },
        validationResults: [],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      // Mock the intent conversion to not include sourceChainId
      const intentWithoutSourceChainId = {
        sourceChainId: undefined,
      } as any;

      jest
        .spyOn(service as any, 'convertToIntent')
        .mockReturnValue(intentWithoutSourceChainId as Intent);

      await expect(service.getQuote(mockQuoteRequest)).rejects.toThrow(
        new BadRequestException('Intent sourceChainId is required'),
      );
    });

    it('should validate contracts when provided in request', async () => {
      const mockQuoteRequestWithContracts: QuoteRequest = {
        ...mockQuoteRequest,
        contracts: {
          sourcePortal: '0x1234567890123456789012345678901234567890',
          destinationPortal: '0x1234567890123456789012345678901234567890',
          prover: '0x1234567890123456789012345678901234567890',
        },
      };

      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: {
          reward: {
            native: 0n,
            tokens: BigInt('5000000000000000000'),
          },
          route: {
            native: 0n,
            tokens: BigInt('1000000000000000'),
            maximum: {
              native: 0n,
              tokens: BigInt('4998995000000000000'),
            },
          },
          fee: {
            base: BigInt('1000000000000000'),
            percentage: BigInt('5000000000000000'),
            total: BigInt('1005000000000000'),
            bps: 0.1,
          },
        },
        validationResults: [],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      const result = await service.getQuote(mockQuoteRequestWithContracts);

      expect(result).toBeDefined();
      expect('contracts' in result && result.contracts).toBeDefined();
    });

    it('should throw error when provided sourcePortal does not match configuration', async () => {
      const mockQuoteRequestWithWrongPortal: QuoteRequest = {
        ...mockQuoteRequest,
        contracts: {
          sourcePortal: '0x9999999999999999999999999999999999999999',
        },
      };

      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: {
          reward: {
            native: 0n,
            tokens: BigInt('5000000000000000000'),
          },
          route: {
            native: 0n,
            tokens: BigInt('1000000000000000'),
            maximum: {
              native: 0n,
              tokens: BigInt('4998995000000000000'),
            },
          },
          fee: {
            base: BigInt('1000000000000000'),
            percentage: BigInt('5000000000000000'),
            total: BigInt('1005000000000000'),
            bps: 0.1,
          },
        },
        validationResults: [],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      await expect(service.getQuote(mockQuoteRequestWithWrongPortal)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should skip contract validation when contracts are not provided', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: {
          reward: {
            native: 0n,
            tokens: BigInt('5000000000000000000'),
          },
          route: {
            native: 0n,
            tokens: BigInt('1000000000000000'),
            maximum: {
              native: 0n,
              tokens: BigInt('4998995000000000000'),
            },
          },
          fee: {
            base: BigInt('1000000000000000'),
            percentage: BigInt('5000000000000000'),
            total: BigInt('1005000000000000'),
            bps: 0.1,
          },
        },
        validationResults: [],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      const result = await service.getQuote(mockQuoteRequest);

      expect(result).toBeDefined();
      expect('contracts' in result && result.contracts).toBeDefined();
    });

    it('should properly convert quote request to Intent interface', async () => {
      const mockQuoteResult: QuoteResult = {
        valid: true,
        strategy: 'standard',
        fees: {
          reward: {
            native: 0n,
            tokens: BigInt('5000000000000000000'),
          },
          route: {
            native: 0n,
            tokens: BigInt('1000000000000000'),
            maximum: {
              native: 0n,
              tokens: BigInt('4998995000000000000'),
            },
          },
          fee: {
            base: BigInt('1000000000000000'),
            percentage: BigInt('5000000000000000'),
            total: BigInt('1005000000000000'),
            bps: 0.1,
          },
        },
        validationResults: [],
      };

      mockFulfillmentService.getStrategy.mockReturnValue(
        mockStrategy as unknown as FulfillmentStrategy,
      );
      mockStrategy.canHandle.mockReturnValue(true);
      mockStrategy.getQuote.mockResolvedValue(mockQuoteResult);

      await service.getQuote(mockQuoteRequest);

      expect(mockStrategy.canHandle).toHaveBeenCalledWith(
        expect.objectContaining({
          intentHash: expect.any(String),
          destination: BigInt('10'),
          sourceChainId: BigInt('1'),
          reward: expect.objectContaining({
            prover: '0x0000000000000000000000001234567890123456789012345678901234567890',
            creator: '0x0000000000000000000000001234567890123456789012345678901234567890',
            deadline: expect.any(BigInt),
            nativeAmount: BigInt('0'),
          }),
          route: expect.objectContaining({
            salt: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
            portal: '0x0000000000000000000000001234567890123456789012345678901234567890',
          }),
        }),
      );
    });
  });
});
