import { Test, TestingModule } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { createMock } from '@golevelup/ts-jest'
import { QuoteController } from '@/api/quote.controller'
import { QuoteService } from '@/quote/quote.service'
import { InternalSaveError, SolverUnsupported } from '@/quote/errors'
import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { serialize } from '@/liquidity-manager/utils/serialize'

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
    const quote = {
      tokens: [
        {
          address: '0x123',
          amount: 100n,
        },
      ],
      expiryTime: 0,
    }
    it('should return a 400 on bad request', async () => {
      jest.spyOn(quoteService, 'getQuote').mockResolvedValue(SolverUnsupported)
      await expect(quoteController.getQuote({} as any)).rejects.toThrow(
        new BadRequestException(serialize(SolverUnsupported)),
      )
    })

    it('should return a 500 on server error', async () => {
      jest.spyOn(quoteService, 'getQuote').mockResolvedValue(InternalSaveError(quote as any))
      jest.spyOn(quoteService, 'storeQuoteIntentData').mockResolvedValue(quote as any)
      await expect(quoteController.getQuote({} as any)).rejects.toThrow(
        new InternalServerErrorException(InternalSaveError(quote as any)),
      )
    })

    it('should log and return a quote', async () => {
      jest.spyOn(quoteService, 'getQuote').mockResolvedValue(quote as any)

      const result = await quoteController.getQuote({} as any)
      expect(result).toEqual(quote)
      expect(quoteService.getQuote).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledTimes(2)
    })
  })
})
