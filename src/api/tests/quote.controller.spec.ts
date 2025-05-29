import { Test, TestingModule } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { createMock } from '@golevelup/ts-jest'
import { QuoteController } from '@/api/quote.controller'
import { QuoteService } from '@/quote/quote.service'
import { InternalSaveError, SolverUnsupported } from '@/quote/errors'
import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { serialize } from '@/common/utils/serialize'

describe('QuoteController Test', () => {
  let quoteController: QuoteController
  let quoteService: QuoteService
  const mockLogLog = jest.fn()

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        {
          provide: QuoteService,
          useValue: createMock<QuoteService>(),
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile()

    quoteController = module.get(QuoteController)
    quoteService = module.get(QuoteService)

    quoteController['logger'].log = mockLogLog
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogLog.mockClear()
  })

  it('should be defined', () => {
    expect(quoteController).toBeDefined()
  })

  describe('getQuote', () => {
    const mockQuoteResponse = {
      tokens: [
        {
          token: '0x123',
          amount: 100n,
        },
      ],
      expiryTime: '1234567890',
      estimatedFulfillTimeSec: 9,
    }

    it('should return a 400 on bad request', async () => {
      jest.spyOn(quoteService, 'getQuote').mockResolvedValue(SolverUnsupported)
      await expect(quoteController.getQuote({} as any)).rejects.toThrow(
        new BadRequestException(serialize(SolverUnsupported)),
      )
    })

    it('should return a 500 on server error', async () => {
      jest
        .spyOn(quoteService, 'getQuote')
        .mockResolvedValue(InternalSaveError(mockQuoteResponse as any))
      await expect(quoteController.getQuote({} as any)).rejects.toThrow(
        new InternalServerErrorException(serialize(InternalSaveError(mockQuoteResponse as any))),
      )
    })

    it('should log and return a quote including estimatedFulfillTimeSec', async () => {
      jest.spyOn(quoteService, 'getQuote').mockResolvedValue(mockQuoteResponse as any)

      const result = await quoteController.getQuote({} as any)
      expect(result).toEqual(mockQuoteResponse)
      expect(quoteService.getQuote).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledTimes(2)
    })
  })
})
