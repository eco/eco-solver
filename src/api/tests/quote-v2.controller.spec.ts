import { EcoAnalyticsService } from '@/analytics'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteService } from '@/quote/quote.service'
import { QuoteV2Controller } from '@/api/quote-v2.controller'
import { QuoteV2RequestDTO } from '@/quote/dto/v2/quote-v2-request.dto'
import { QuoteV2RequestTransformService } from '@/quote/services/quote-v2-request-transform.service'
import { QuoteV2ResponseDTO } from '@/quote/dto/v2/quote-v2-response.dto'
import { QuoteV2Service } from '@/quote/quote-v2.service'
import { QuoteV2TransformService } from '@/quote/services/quote-v2-transform.service'
import { SolverUnsupported } from '@/quote/errors'

describe('QuoteV2Controller', () => {
  let $: EcoTester
  let controller: QuoteV2Controller
  let quoteService: QuoteService
  let quoteV2TransformService: QuoteV2TransformService
  let quoteV2RequestTransformService: QuoteV2RequestTransformService
  let ecoAnalytics: EcoAnalyticsService

  const mockV2Request: QuoteV2RequestDTO = {
    dAppID: 'test-dapp-id',
    quoteRequest: {
      sourceChainID: 1,
      destinationChainID: 137,
      sourceToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as any, // USDC
      destinationToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as any, // USDC on Polygon
      sourceAmount: '1000000', // 1 USDC
      funder: '0x9876543210987654321098765432109876543210' as any,
      recipient: '0x1234567890123456789012345678901234567890' as any,
    },
  }

  const mockQuoteIntentDataDTO: QuoteIntentDataDTO = {
    quoteID: 'test-quote-id',
    dAppID: 'test-dapp-id',
    intentExecutionTypes: [IntentExecutionType.SELF_PUBLISH.toString()],
    route: {
      source: 1n,
      destination: 137n,
      inbox: '0x1234567890123456789012345678901234567890',
      tokens: [
        {
          token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          amount: 1000000n,
        },
      ],
      calls: [
        {
          target: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          data: '0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890000000000000000000000000000000000000000000000000000000000000000a',
          value: 0n,
        },
      ],
    },
    reward: {
      creator: '0x9876543210987654321098765432109876543210',
      prover: '0x5555555555555555555555555555555555555555',
      deadline: 1234567890n,
      nativeValue: 0n,
      tokens: [
        {
          token: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          amount: 950000n,
        },
      ],
    },
  }

  const mockQuoteDataDTO: QuoteDataDTO = {
    quoteEntries: [
      {
        intentExecutionType: IntentExecutionType.SELF_PUBLISH.toString(),
        routeTokens: mockQuoteIntentDataDTO.route.tokens,
        routeCalls: mockQuoteIntentDataDTO.route.calls,
        rewardTokens: mockQuoteIntentDataDTO.reward.tokens,
        rewardNative: 0n,
        expiryTime: '1234567890',
        estimatedFulfillTimeSec: 60,
        gasOverhead: 145000,
      },
    ],
  }

  const mockQuoteV2Response: QuoteV2ResponseDTO = {
    quoteResponse: {
      intentExecutionType: IntentExecutionType.SELF_PUBLISH.toString(),
      sourceChainID: 1,
      destinationChainID: 137,
      sourceToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      destinationToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      sourceAmount: '1000000',
      destinationAmount: '950000',
      funder: '0x9876543210987654321098765432109876543210',
      refundRecipient: '0x9876543210987654321098765432109876543210',
      recipient: '0x1234567890123456789012345678901234567890',
      fees: [
        {
          name: 'Eco Protocol Fee',
          description: 'Fee for processing the intent through Eco Protocol',
          token: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 18,
            symbol: 'TOKEN',
          },
          amount: '50000',
        },
      ],
      deadline: 1234567890,
      estimatedFulfillTimeSec: 60,
    },
    contracts: {
      sourcePortal: '0x0000000000000000000000000000000000000000',
      prover: '0x5555555555555555555555555555555555555555',
      destinationPortal: '0x1234567890123456789012345678901234567890',
    },
  }

  beforeAll(async () => {
    $ = EcoTester.setupTestFor(QuoteV2Controller)
      .withProviders([QuoteV2Service])
      .withMocks([
        QuoteService,
        QuoteV2TransformService,
        QuoteV2RequestTransformService,
        EcoAnalyticsService,
      ])

    controller = await $.init()
    quoteService = $.get(QuoteService)
    quoteV2TransformService = $.get(QuoteV2TransformService)
    quoteV2RequestTransformService = $.get(QuoteV2RequestTransformService)
    ecoAnalytics = $.get(EcoAnalyticsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getQuote', () => {
    it('should return a V2 quote successfully using reverse quote logic', async () => {
      // Arrange
      jest
        .spyOn(quoteV2RequestTransformService, 'transformToQuoteIntent')
        .mockReturnValue(mockQuoteIntentDataDTO)
      jest.spyOn(quoteService, 'getReverseQuote').mockResolvedValue({ response: mockQuoteDataDTO })
      jest.spyOn(quoteV2TransformService, 'transformToV2').mockResolvedValue(mockQuoteV2Response)

      // Act
      const result = await controller.getReverseQuote(mockV2Request)

      // Assert
      expect(result).toEqual(mockQuoteV2Response)
      expect(quoteV2RequestTransformService.transformToQuoteIntent).toHaveBeenCalledWith(
        mockV2Request,
      )
      expect(quoteService.getReverseQuote).toHaveBeenCalledWith(mockQuoteIntentDataDTO)
      expect(quoteV2TransformService.transformToV2).toHaveBeenCalledWith(
        mockQuoteDataDTO,
        mockQuoteIntentDataDTO,
      )
      expect(ecoAnalytics.trackSuccess).toHaveBeenCalledTimes(1) // Request received and response success
    })

    it('should handle request transformation errors', async () => {
      // Arrange
      jest
        .spyOn(quoteV2RequestTransformService, 'transformToQuoteIntent')
        .mockImplementation(() => {
          throw new Error('Invalid request')
        })

      // Act & Assert
      await expect(controller.getReverseQuote(mockV2Request)).rejects.toThrow()
    })

    it('should handle quote service errors', async () => {
      // Arrange
      jest
        .spyOn(quoteV2RequestTransformService, 'transformToQuoteIntent')
        .mockReturnValue(mockQuoteIntentDataDTO)
      jest.spyOn(quoteService, 'getReverseQuote').mockResolvedValue({ error: SolverUnsupported })

      // Act & Assert
      await expect(controller.getReverseQuote(mockV2Request)).rejects.toThrow()
      expect(ecoAnalytics.trackError).toHaveBeenCalled()
    })

    it('should handle transformation errors', async () => {
      // Arrange
      jest
        .spyOn(quoteV2RequestTransformService, 'transformToQuoteIntent')
        .mockReturnValue(mockQuoteIntentDataDTO)
      jest.spyOn(quoteService, 'getReverseQuote').mockResolvedValue({ response: mockQuoteDataDTO })
      jest.spyOn(quoteV2TransformService, 'transformToV2').mockResolvedValue(null)

      // Act & Assert
      await expect(controller.getReverseQuote(mockV2Request)).rejects.toThrow()
      expect(ecoAnalytics.trackError).toHaveBeenCalled()
    })
  })
})
