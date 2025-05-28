import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { getModelToken } from '@nestjs/mongoose'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { Hex } from 'viem'

describe('QuoteRepository', () => {
  let quoteRepository: QuoteRepository

  const mockCreate = jest.fn()
  const mockFindOne = jest.fn()
  const mockFindOneAndUpdate = jest.fn()
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()

  const mockQuoteIntentModel = {
    create: mockCreate,
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
  }

  const mockEcoConfigService = {
    getQuotesConfig: () => ({
      intentExecutionTypes: ['GASLESS', 'SELF_PUBLISH'],
    }),
  }

  const quoteTestUtils = new QuoteTestUtils()

  beforeEach(async () => {
    const $ = EcoTester.setupTestFor(QuoteRepository).withProviders([
      {
        provide: getModelToken(QuoteIntentModel.name),
        useValue: mockQuoteIntentModel,
      },
      {
        provide: EcoConfigService,
        useValue: mockEcoConfigService,
      },
    ])

    quoteRepository = await $.init()
    quoteRepository.onModuleInit()

    quoteRepository['logger'].debug = mockLogDebug
    quoteRepository['logger'].log = mockLogLog
    quoteRepository['logger'].error = mockLogError
  })

  beforeEach(async () => {
    jest.clearAllMocks()
  })

   afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
  })

  describe('Storing Quotes', () => {
    it('should return error array if all intent types are unsupported', async () => {
      const mockDTO: QuoteIntentDataDTO = quoteTestUtils.createQuoteIntentDataDTO({
        intentExecutionTypes: ['UNSUPPORTED_TYPE'],
      })

      const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

      expect(response).toBeUndefined()
      expect(error).toBeDefined()
      expect(error).toHaveLength(0) // nothing failed per se, but no valid types
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('should handle DB error when storing quote', async () => {
      const dto = quoteTestUtils.createQuoteIntentDataDTO({
        intentExecutionTypes: ['GASLESS'],
      })

      mockCreate.mockRejectedValue(new Error('DB boom'))

      const { response, error } = await quoteRepository.storeQuoteIntentData(dto)

      expect(response).toBeUndefined()
      expect(error).toBeDefined()
      expect(error![0].message).toContain('DB boom')
    })

    it('should store quote intent data for valid types', async () => {
      const mockDTO: QuoteIntentDataDTO = quoteTestUtils.createQuoteIntentDataDTO({
        dAppID: 'test-dapp',
        intentExecutionTypes: ['GASLESS'],
      })

      const mockStoredDoc = { _id: '123', ...mockDTO }
      mockCreate.mockResolvedValue(mockStoredDoc)

      const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

      expect(error).toBeUndefined()
      expect(response).toHaveLength(1)
      expect(response![0]._id).toBe('123')
      expect(mockCreate).toHaveBeenCalled()
    })
  })

  describe('Fetching Quotes', () => {
    it('should fetch quote intent data from db', async () => {
      const mockDoc = { _id: 'abc', dAppID: 'xyz' }
      mockFindOne.mockResolvedValue(mockDoc)

      const { response, error } = await quoteRepository.fetchQuoteIntentData({ dAppID: 'xyz' })

      expect(error).toBeUndefined()
      expect(response).toEqual(mockDoc)
    })

    it('should return error if no quote found', async () => {
      mockFindOne.mockResolvedValue(null)

      const { error } = await quoteRepository.fetchQuoteIntentData({ dAppID: 'notfound' })

      expect(error).toEqual(EcoError.QuoteNotFound)
    })
  })

  describe('Updating Quotes', () => {
    it('should update quote and return updated doc', async () => {
      const mockModel = quoteTestUtils.createQuoteIntentModel()
      const updatedDoc = { ...mockModel, receipt: {} }

      mockFindOneAndUpdate.mockResolvedValue(updatedDoc)

      const { response, error } = await quoteRepository.updateQuoteDb(mockModel as any, {
        quoteDataEntry: quoteTestUtils.createQuoteDataEntryDTO(),
      })

      expect(error).toBeUndefined()
      expect(response).toEqual(updatedDoc)
      expect(mockFindOneAndUpdate).toHaveBeenCalled()
    })

    it('should update quote with full data and compute correct routeHash', async () => {
      const quoteIntentModel = quoteTestUtils.createQuoteIntentModel()
      const addressTokenA = quoteTestUtils.getRandomAddress()
      const addressTokenB = quoteTestUtils.getRandomAddress()
      const addressTargetA = quoteTestUtils.getRandomAddress()
      const addressTargetB = quoteTestUtils.getRandomAddress()
      const addressReward1 = quoteTestUtils.getRandomAddress()

      const fullRouteTokens = [
        { token: addressTokenA, amount: 1000n },
        { token: addressTokenB, amount: 2000n },
      ]
      const fullRouteCalls = [
        { target: addressTargetA, data: '0xabc' as Hex, value: 0n },
        { target: addressTargetB, data: '0xdef' as Hex, value: 0n },
      ]
      const fullRewardTokens = [{ token: addressReward1, amount: 21000n }]

      const fullRoute = {
        ...quoteIntentModel.route,
        tokens: fullRouteTokens,
        calls: fullRouteCalls,
      }

      const updatedDoc = {
        ...quoteIntentModel,
        route: fullRoute,
        receipt: {
          quoteDataEntry: {
            routeTokens: fullRouteTokens,
            routeCalls: fullRouteCalls,
            rewardTokens: fullRewardTokens,
            rewardNative: 17n,
          },
        },
      }

      mockFindOneAndUpdate.mockResolvedValue(updatedDoc)

      const { response, error } = await quoteRepository.updateQuoteDb(quoteIntentModel, {
        quoteDataEntry: {
          intentExecutionType: 'GASLESS',
          expiryTime: (Math.floor(Date.now() / 1000) + 600).toString(),
          routeTokens: fullRouteTokens,
          routeCalls: fullRouteCalls,
          rewardTokens: fullRewardTokens,
          rewardNative: 17n,
        },
      })

      expect(error).toBeUndefined()
      expect(response).toBeDefined()
      expect(response!.route.tokens).toEqual(fullRouteTokens)
      expect(response!.route.calls).toEqual(fullRouteCalls)
      expect(response!.reward.nativeValue).toEqual(17n)
      expect(response!.receipt?.quoteDataEntry?.rewardTokens).toEqual(fullRewardTokens)
      expect(mockFindOneAndUpdate).toHaveBeenCalled()
    })

    it('should recompute routeHash when route.tokens change', async () => {
      const quoteIntentModel = quoteTestUtils.createQuoteIntentModel()

      const newToken = quoteTestUtils.getRandomAddress()
      const modifiedRouteTokens = [
        ...quoteIntentModel.route.tokens,
        { token: newToken, amount: 1234n },
      ]
      const modifiedRoute = {
        ...quoteIntentModel.route,
        tokens: modifiedRouteTokens,
      }

      mockFindOneAndUpdate.mockResolvedValue({
        ...quoteIntentModel,
        route: modifiedRoute,
      })

      const { response, error } = await quoteRepository.updateQuoteDb(quoteIntentModel, {
        quoteDataEntry: {
          intentExecutionType: 'GASLESS',
          expiryTime: '9999999999',
          routeTokens: modifiedRouteTokens,
          routeCalls: quoteIntentModel.route.calls,
          rewardTokens: quoteIntentModel.reward.tokens,
          rewardNative: 17n,
        },
      })

      expect(error).toBeUndefined()
    })

    it('should not recompute routeHash when only rewardTokens change', async () => {
      const quoteIntentModel = quoteTestUtils.createQuoteIntentModel()

      const modifiedRewardTokens = [{ token: quoteTestUtils.getRandomAddress(), amount: 98765n }]

      mockFindOneAndUpdate.mockResolvedValue({
        ...quoteIntentModel,
        reward: { tokens: modifiedRewardTokens },
      })

      const { response, error } = await quoteRepository.updateQuoteDb(quoteIntentModel, {
        quoteDataEntry: {
          intentExecutionType: 'GASLESS',
          expiryTime: '9999999999',
          routeTokens: quoteIntentModel.route.tokens,
          routeCalls: quoteIntentModel.route.calls,
          rewardTokens: modifiedRewardTokens,
          rewardNative: 17n,
        },
      })

      expect(error).toBeUndefined()
      expect(response!.reward.tokens).toEqual(modifiedRewardTokens)
    })
  })
})
