import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { createMock } from '@golevelup/ts-jest'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { InternalSaveError, SolverUnsupported } from '@/quote/errors'
import { QuoteController } from '@/api/quote.controller'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteService } from '@/quote/quote.service'
import { serialize } from '@/liquidity-manager/utils/serialize'
import { Test, TestingModule } from '@nestjs/testing'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'

describe('QuoteController Test', () => {
  let quoteController: QuoteController
  let quoteService: QuoteService
  const mockLogLog = jest.fn()
  const quoteTestUtils = new QuoteTestUtils()

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
    const quote: QuoteDataDTO = {
      quoteEntries: [
        {
          intentExecutionType: IntentExecutionType.SELF_PUBLISH.toString(),
          route: quoteTestUtils.createQuoteRouteDataDTO(),
          tokens: [
            {
              token: '0x123',
              amount: 100n,
            },
          ],
          expiryTime: '0',
        },
        {
          intentExecutionType: IntentExecutionType.GASLESS.toString(),
          route: quoteTestUtils.createQuoteRouteDataDTO(),
          tokens: [
            {
              token: '0x456',
              amount: 200n,
            },
          ],
          expiryTime: '10',
        },
      ],
    }

    it('should return a 400 on bad request', async () => {
      jest.spyOn(quoteService, 'getQuote').mockResolvedValue({ error: SolverUnsupported })
      await expect(quoteController.getQuote({} as any)).rejects.toThrow(
        new BadRequestException(serialize(SolverUnsupported)),
      )
    })

    it('should return a 500 on server error', async () => {
      jest
        .spyOn(quoteService, 'getQuote')
        .mockResolvedValue({ error: InternalSaveError(quote as any) })
      jest.spyOn(quoteService, 'storeQuoteIntentData').mockResolvedValue(quote as any)
      await expect(quoteController.getQuote({} as any)).rejects.toThrow(
        new InternalServerErrorException(InternalSaveError(quote as any)),
      )
    })

    it('should log and return a quote', async () => {
      jest.spyOn(quoteService, 'getQuote').mockResolvedValue({ response: quote as any })

      const result = await quoteController.getQuote({} as any)
      expect(result).toEqual(quote)
      expect(quoteService.getQuote).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledTimes(2)
    })
  })
})
