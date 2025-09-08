import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { createMock } from '@golevelup/ts-jest'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { InternalSaveError, SolverUnsupported } from '@/quote/errors'
import { QuoteController } from '@/api/quote.controller'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteService } from '@/quote/quote.service'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { Test, TestingModule } from '@nestjs/testing'
import { EcoAnalyticsService } from '@/analytics'

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
        {
          provide: EcoAnalyticsService,
          useValue: createMock<EcoAnalyticsService>(),
        },
      ],
    }).compile()

    quoteController = module.get(QuoteController)
    quoteService = module.get(QuoteService)

    // Mock the structured logger's log method - it expects (context, message, properties)
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
    const route = quoteTestUtils.createQuoteRouteDataDTO()
    const quote: QuoteDataDTO = {
      quoteEntries: [
        {
          intentExecutionType: IntentExecutionType.SELF_PUBLISH.toString(),
          routeTokens: route.tokens,
          routeCalls: route.calls,
          rewardTokens: [
            {
              token: '0x123',
              amount: 100n,
            },
          ],
          rewardNative: 10n,
          expiryTime: '0',
          estimatedFulfillTimeSec: 9,
          gasOverhead: 145_000,
        },
        {
          intentExecutionType: IntentExecutionType.GASLESS.toString(),
          routeTokens: route.tokens,
          routeCalls: route.calls,
          rewardTokens: [
            {
              token: '0x456',
              amount: 200n,
            },
          ],
          rewardNative: 11n,
          expiryTime: '10',
          estimatedFulfillTimeSec: 9,
          gasOverhead: 145_000,
        },
      ],
    }

    it('should return a 400 on bad request', async () => {
      const quoteRequest = quoteTestUtils.createQuoteIntentDataDTO()
      jest.spyOn(quoteService, 'getQuote').mockResolvedValue({ error: SolverUnsupported })

      try {
        const response = await quoteController.getQuote(quoteRequest)
      } catch (ex) {
        expect(ex.status).toEqual(400)
        expect(ex.response.errorDesc).toContain("The solver doesn't support that chain.")
      }
    })

    it('should return a 500 on server error', async () => {
      const quoteRequest = quoteTestUtils.createQuoteIntentDataDTO()
      jest
        .spyOn(quoteService, 'getQuote')
        .mockResolvedValue({ error: InternalSaveError(quote as any) })
      jest.spyOn(quoteService, 'storeQuoteIntentData').mockResolvedValue(quote as any)

      try {
        const response = await quoteController.getQuote(quoteRequest)
      } catch (ex) {
        expect(ex.status).toEqual(500)
        expect(ex.response.errorDesc).toContain('Internal Server Error')
      }
    })

    it('should log and return a quote', async () => {
      const quoteRequest = quoteTestUtils.createQuoteIntentDataDTO()
      jest.spyOn(quoteService, 'getQuote').mockResolvedValue({ response: quote as any })

      const result = await quoteController.getQuote(quoteRequest)
      expect(result).toEqual(quote)
      expect(quoteService.getQuote).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledTimes(2)
    })
  })

  describe('getReverseQuote', () => {
    const route = quoteTestUtils.createQuoteRouteDataDTO()
    const quote: QuoteDataDTO = {
      quoteEntries: [
        {
          intentExecutionType: IntentExecutionType.SELF_PUBLISH.toString(),
          routeTokens: route.tokens,
          routeCalls: route.calls,
          rewardTokens: [
            {
              token: '0x123',
              amount: 100n,
            },
          ],
          rewardNative: 11n,
          expiryTime: '0',
          estimatedFulfillTimeSec: 9,
          gasOverhead: 145_000,
        },
        {
          intentExecutionType: IntentExecutionType.GASLESS.toString(),
          routeTokens: route.tokens,
          routeCalls: route.calls,
          rewardTokens: [
            {
              token: '0x456',
              amount: 200n,
            },
          ],
          rewardNative: 12n,
          expiryTime: '10',
          estimatedFulfillTimeSec: 9,
          gasOverhead: 145_000,
        },
      ],
    }

    it('should return a 400 on bad request', async () => {
      const quoteRequest = quoteTestUtils.createQuoteIntentDataDTO()
      jest.spyOn(quoteService, 'getReverseQuote').mockResolvedValue({ error: SolverUnsupported })

      try {
        const response = await quoteController.getReverseQuote(quoteRequest)
      } catch (ex) {
        expect(ex.status).toEqual(400)
        expect(ex.response.errorDesc).toContain("The solver doesn't support that chain.")
      }
    })

    it('should return a 500 on server error', async () => {
      const quoteRequest = quoteTestUtils.createQuoteIntentDataDTO()
      jest
        .spyOn(quoteService, 'getReverseQuote')
        .mockResolvedValue({ error: InternalSaveError(quote as any) })
      jest.spyOn(quoteService, 'storeQuoteIntentData').mockResolvedValue(quote as any)

      try {
        const response = await quoteController.getReverseQuote(quoteRequest)
      } catch (ex) {
        expect(ex.status).toEqual(500)
        expect(ex.response.errorDesc).toContain('Internal Server Error')
      }
    })

    it('should log and return a reverse quote', async () => {
      const quoteRequest = quoteTestUtils.createQuoteIntentDataDTO()
      jest.spyOn(quoteService, 'getReverseQuote').mockResolvedValue({ response: quote as any })

      const result = await quoteController.getReverseQuote(quoteRequest)
      expect(result).toEqual(quote)
      expect(quoteService.getReverseQuote).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledTimes(2)
    })
  })
})
