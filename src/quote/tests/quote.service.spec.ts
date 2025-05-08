const mockGetTransactionTargetData = jest.fn()
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeeService } from '@/fee/fee.service'
import { ValidationChecks, ValidationService } from '@/intent/validation.sevice'
import {
  InfeasibleQuote,
  InsufficientBalance,
  InternalQuoteError,
  InternalSaveError,
  InvalidQuoteIntent,
  QuoteError,
  SolverUnsupported,
} from '@/quote/errors'
import { QuoteService } from '@/quote/quote.service'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { Model } from 'mongoose'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { QuotesConfig } from '@/eco-configs/eco-config.types'
import { zeroAddress } from 'viem'
import { QuoteRepository } from '@/quote/quote.repository'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'

jest.mock('@/intent/utils', () => {
  return {
    ...jest.requireActual('@/intent/utils'),
    getTransactionTargetData: mockGetTransactionTargetData,
  }
})

describe('QuotesService', () => {
  let quoteService: QuoteService
  let quoteRepository: QuoteRepository
  let feeService: DeepMocked<FeeService>
  let validationService: DeepMocked<ValidationService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let quoteModel: DeepMocked<Model<QuoteIntentModel>>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()
  const quoteTestUtils = new QuoteTestUtils()

  beforeEach(async () => {
    const quotesConfig = { intentExecutionTypes: ['SELF_PUBLISH', 'GASLESS'] }
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
        QuoteRepository,
        IntentInitiationService,
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: ValidationService, useValue: createMock<ValidationService>() },
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: getModelToken(QuoteIntentModel.name),
          useValue: createMock<Model<QuoteIntentModel>>(),
        },
      ],
    }).compile()

    quoteService = chainMod.get(QuoteService)
    quoteRepository = chainMod.get(QuoteRepository)
    feeService = chainMod.get(FeeService)
    validationService = chainMod.get(ValidationService)

    ecoConfigService = chainMod.get(EcoConfigService)
    quoteModel = chainMod.get(getModelToken(QuoteIntentModel.name))

    quoteService['logger'].debug = mockLogDebug
    quoteService['logger'].log = mockLogLog
    quoteService['logger'].error = mockLogError
    quoteService['quotesConfig'] = quotesConfig as QuotesConfig

    quoteRepository['logger'].debug = mockLogDebug
    quoteRepository['logger'].log = mockLogLog
    quoteRepository['logger'].error = mockLogError
    quoteRepository['quotesConfig'] = quotesConfig as QuotesConfig
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
    mockLogError.mockClear()
  })

  describe('on getQuote', () => {
    const quoteIntent = { reward: { tokens: [] }, route: {} } as any
    it('should throw an error if it cant store the quote in the db ', async () => {
      const failedStore = new Error('error')
      quoteService.storeQuoteIntentData = jest.fn().mockResolvedValue({ error: failedStore })
      const { error } = await quoteService.getQuote({} as any)
      expect(error).toEqual(InternalSaveError(failedStore))
    })

    it('should return a 400 if it fails to validate the quote data', async () => {
      quoteService.storeQuoteIntentData = jest
        .fn()
        .mockResolvedValue({ response: [quoteTestUtils.createQuoteIntentModel()] })
      quoteService.validateQuoteIntentData = jest.fn().mockResolvedValue(SolverUnsupported)
      const { error } = await quoteService.getQuote({} as any)
      expect(error).toEqual([SolverUnsupported])
    })

    it('should save any error in getting the quote to the db', async () => {
      const quoteIntent = quoteTestUtils.createQuoteIntentModel()
      const failedStore = new Error('error')

      quoteService.storeQuoteIntentData = jest.fn().mockResolvedValue({
        response: [quoteIntent],
      })

      quoteService.validateQuoteIntentData = jest.fn().mockResolvedValue(undefined)
      quoteService.generateQuote = jest.fn().mockImplementation(() => {
        throw failedStore
      })

      const mockDb = jest.spyOn(quoteService, 'updateQuoteDb')

      const { error } = await quoteService.getQuote({} as any)

      expect(error).toBeDefined()
      expect(mockDb).toHaveBeenCalled()
      expect(mockDb).toHaveBeenCalledWith(quoteIntent, {
        error: expect.objectContaining({ message: expect.stringContaining('error') }),
      })
    })
  })

  describe('on storeQuoteIntentData', () => {
    it('should log error if storing fails', async () => {
      const failedStore = new Error('error')
      jest.spyOn(quoteModel, 'create').mockRejectedValue(failedStore)
      const quoteIntent = quoteTestUtils.createQuoteIntentDataDTO()
      const { error } = await quoteService.storeQuoteIntentData(quoteIntent)
      expect(error).toBeDefined()
      expect(mockLogError).toHaveBeenCalled()
    })

    it('should save the DTO and return a record', async () => {
      const quoteIntentData = quoteTestUtils.createQuoteIntentDataDTO({
        intentExecutionTypes: [IntentExecutionType.GASLESS.toString()],
      })
      const quoteIntentModel = quoteTestUtils.getQuoteIntentModel(
        quoteIntentData.intentExecutionTypes[0],
        quoteIntentData,
      )
      jest.spyOn(quoteModel, 'create').mockResolvedValue(quoteIntentModel as any)
      const { response: quoteIntentModels } =
        await quoteService.storeQuoteIntentData(quoteIntentData)
      expect(quoteIntentModels).toEqual([quoteIntentModel])
      expect(mockLogError).not.toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalled()
    })
  })

  describe('on validateQuoteIntentData', () => {
    const quoteIntentModel = {
      _id: 'id9',
      route: {
        destination: 1n,
      },
    }
    const failValidations: ValidationChecks = {
      supportedProver: true,
      supportedTargets: true,
      supportedSelectors: true,
      validTransferLimit: true,
      validExpirationTime: true,
      validDestination: false,
      fulfillOnDifferentChain: true,
    }
    const validValidations: ValidationChecks = {
      supportedProver: true,
      supportedTargets: true,
      supportedSelectors: true,
      validTransferLimit: true,
      validExpirationTime: true,
      validDestination: true,
      fulfillOnDifferentChain: true,
    }
    let updateQuoteDb: jest.SpyInstance
    beforeEach(() => {
      updateQuoteDb = jest.spyOn(quoteService, 'updateQuoteDb')
    })

    afterEach(() => {
      updateQuoteDb.mockClear()
    })

    it('should return solver unsupported if no solver for destination', async () => {
      ecoConfigService.getSolver = jest.fn().mockReturnValue(undefined)
      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(
        SolverUnsupported,
      )
      expect(mockLogLog).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `validateQuoteIntentData: No solver found for destination : ${quoteIntentModel.route.destination}`,
        quoteIntentModel,
      })
      expect(updateQuoteDb).toHaveBeenCalledWith(quoteIntentModel, { error: SolverUnsupported })
    })

    it('should return invalid quote if the quote fails validations', async () => {
      ecoConfigService.getSolver = jest.fn().mockReturnValue({})
      validationService.assertValidations = jest.fn().mockReturnValue(failValidations)

      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(
        InvalidQuoteIntent(failValidations),
      )
      expect(mockLogLog).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `validateQuoteIntentData: Some validations failed`,
        quoteIntentModel,
        validations: failValidations,
      })
      expect(updateQuoteDb).toHaveBeenCalledWith(quoteIntentModel, {
        error: InvalidQuoteIntent(failValidations),
      })
    })

    it('should return infeasable if the quote is infeasable', async () => {
      const error = QuoteError.SolverLacksLiquidity(1, '0x2', 4n, 3n, 2n)
      ecoConfigService.getSolver = jest.fn().mockReturnValue({})
      validationService.assertValidations = jest.fn().mockReturnValue(validValidations)
      feeService.isRouteFeasible = jest.fn().mockResolvedValue({ error })
      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(
        InfeasibleQuote(error),
      )
      expect(mockLogLog).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `validateQuoteIntentData: quote intent is not feasable ${quoteIntentModel._id}`,
        quoteIntentModel,
        feasable: false,
        error: InfeasibleQuote(error),
      })
      expect(updateQuoteDb).toHaveBeenCalledWith(quoteIntentModel, {
        error: InfeasibleQuote(error),
      })
    })

    it('should return nothing if all the validations pass', async () => {
      ecoConfigService.getSolver = jest.fn().mockReturnValue({})
      validationService.assertValidations = jest.fn().mockReturnValue(validValidations)
      feeService.isRouteFeasible = jest.fn().mockResolvedValue({})
      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(undefined)
      expect(updateQuoteDb).not.toHaveBeenCalled()
    })
  })

  describe('on generateQuote', () => {
    it('should return error on calculate tokens failed', async () => {
      const error = new Error('error') as any
      feeService.calculateTokens = jest.fn().mockResolvedValue({ error } as any)
      const { error: quoteError } = await quoteService.generateQuote({} as any)
      expect(quoteError).toEqual(InternalQuoteError(error))
    })

    it('should return error on calculate tokens doesnt return the calculated tokens', async () => {
      feeService.calculateTokens = jest.fn().mockResolvedValue({ calculated: undefined } as any)
      const { error } = await quoteService.generateQuote({} as any)
      expect(error).toEqual(InternalQuoteError(undefined))
    })

    it('should return an insufficient balance if the reward doesnt meet the ask', async () => {
      const calculated = {
        solver: {},
        rewards: [{ balance: 10n }, { balance: 102n }],
        calls: [{ balance: 280n }, { balance: 102n }],
        srcDeficitDescending: [],
      } as any
      jest.spyOn(feeService, 'calculateTokens').mockResolvedValue({ calculated })
      const ask = calculated.calls.reduce((a, b) => a + b.balance, 0n)
      const askMock = jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
      const { error } = await quoteService.generateQuote({ route: {} } as any)
      expect(error).toEqual(InsufficientBalance(ask, 112n))
      expect(askMock).toHaveBeenCalled()
    })

    describe('on building quote', () => {
      beforeEach(() => {})

      async function generateHelper(
        calculated: any,
        expectedTokens: { token: string; amount: bigint }[],
      ) {
        const ask = calculated.calls.reduce((a, b) => a + b.balance, 0n)
        jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
        jest.spyOn(feeService, 'calculateTokens').mockResolvedValue({ calculated })
        feeService.deconvertNormalize = jest.fn().mockImplementation((amount) => {
          return { balance: amount }
        })
        const { response: quoteDataEntry } = await quoteService.generateQuote({
          route: {},
          reward: {},
        } as any)
        expect(quoteDataEntry).toEqual({
          rewardTokens: expectedTokens,
          expiryTime: expect.any(String),
        })
      }

      it('should fill up the most deficit balance', async () => {
        const calculated = {
          solver: {},
          rewards: [
            { address: '0x1', balance: 100n },
            { address: '0x2', balance: 200n },
          ],
          calls: [{ address: '0x3', balance: 50n }],
          srcDeficitDescending: [
            { delta: { balance: -100n, address: '0x1' } },
            { delta: { balance: -50n }, address: '0x2' },
          ],
        } as any
        await generateHelper(calculated, [{ token: '0x1', amount: 50n }])
      })

      it('should fill deficit that has rewards to fill it', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x2', balance: 200n }],
          calls: [{ balance: 150n }],
          srcDeficitDescending: [
            { delta: { balance: -100n, address: '0x1' } },
            { delta: { balance: -50n, address: '0x2' } },
          ],
        } as any
        await generateHelper(calculated, [{ token: '0x2', amount: 150n }])
      })

      it('should fill surplus if no deficit', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x2', balance: 200n }],
          calls: [{ balance: 40n }],
          srcDeficitDescending: [
            { delta: { balance: 100n, address: '0x1' } },
            { delta: { balance: 200n, address: '0x2' } },
          ],
        } as any
        await generateHelper(calculated, [{ token: '0x2', amount: 40n }])
      })

      it('should fill partial deficits', async () => {
        const calculated = {
          solver: {},
          rewards: [
            { address: '0x1', balance: 200n },
            { address: '0x2', balance: 200n },
          ],
          calls: [{ balance: 150n }],
          srcDeficitDescending: [
            { delta: { balance: -100n, address: '0x1' } },
            { delta: { balance: -50n, address: '0x2' } },
          ],
        } as any
        await generateHelper(calculated, [
          { token: '0x1', amount: 100n },
          { token: '0x2', amount: 50n },
        ])
      })

      it('should fill surplus if deficit is not rewarded', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x2', balance: 200n }],
          calls: [{ balance: 150n }],
          srcDeficitDescending: [
            { delta: { balance: -100n, address: '0x1' } },
            { delta: { balance: 100n, address: '0x2' } },
          ],
        } as any
        await generateHelper(calculated, [{ token: '0x2', amount: 150n }])
      })

      it('should fill deficit as much as it can and then surplus', async () => {
        const calculated = {
          solver: {},
          rewards: [
            { address: '0x1', balance: 50n },
            { address: '0x2', balance: 20n },
            { address: '0x3', balance: 200n },
          ],
          calls: [{ balance: 150n }],
          srcDeficitDescending: [
            { delta: { balance: -100n, address: '0x1' } },
            { delta: { balance: -50n, address: '0x2' } },
            { delta: { balance: 100n, address: '0x3' } },
          ],
        } as any
        await generateHelper(calculated, [
          { token: '0x1', amount: 50n },
          { token: '0x2', amount: 20n },
          { token: '0x3', amount: 80n },
        ])
      })

      it('should fill deficit in remaining funds loop that can be filled when rewards dont allow order', async () => {
        const calculated = {
          solver: {},
          rewards: [
            { address: '0x1', balance: 50n },
            { address: '0x2', balance: 200n },
          ],
          calls: [{ balance: 250n }],
          srcDeficitDescending: [
            { delta: { balance: -100n, address: '0x1' } },
            { delta: { balance: -50n, address: '0x2' } },
          ],
        } as any
        await generateHelper(calculated, [
          { token: '0x1', amount: 50n },
          { token: '0x2', amount: 200n },
        ])
      })

      it('should fill surpluses in ascending order', async () => {
        const calculated = {
          solver: {},
          rewards: [
            { address: '0x1', balance: 150n },
            { address: '0x2', balance: 150n },
          ],
          calls: [{ balance: 250n }],
          srcDeficitDescending: [
            { delta: { balance: 10n, address: '0x1' } },
            { delta: { balance: 20n, address: '0x2' } },
          ],
        } as any
        await generateHelper(calculated, [
          { token: '0x1', amount: 150n },
          { token: '0x2', amount: 100n },
        ])
      })
    })
  })

  describe('on generateReverseQuote', () => {
    it('should return error on calculate tokens failed', async () => {
      const error = new Error('error') as any
      feeService.calculateTokens = jest.fn().mockResolvedValue({ error } as any)
      const { error: quoteError } = await quoteService.generateReverseQuote({} as any)
      expect(quoteError).toEqual(InternalQuoteError(error))
    })

    it('should return error on calculate tokens doesnt return the calculated tokens', async () => {
      feeService.calculateTokens = jest.fn().mockResolvedValue({ calculated: undefined } as any)
      const { error } = await quoteService.generateReverseQuote({} as any)
      expect(error).toEqual(InternalQuoteError(undefined))
    })

    it('should return an insufficient balance if the fee exceeds total reward', async () => {
      const calculated = {
        solver: {},
        rewards: [{ balance: 10n }, { balance: 20n }],
        destDeficitDescending: [],
      } as any

      jest.spyOn(feeService, 'calculateTokens').mockResolvedValue({ calculated })
      const totalReward = calculated.rewards.reduce((acc, reward) => acc + reward.balance, 0n)
      const fee = totalReward + 1n
      const feeMock = jest.spyOn(feeService, 'getFee').mockReturnValue(fee)

      const intent = { route: { tokens: [], calls: [] } } as any
      const { error } = await quoteService.generateReverseQuote(intent)
      expect(error).toEqual(InsufficientBalance(fee, totalReward))
      expect(feeMock).toHaveBeenCalled()
    })

    describe('on building reverse quote', () => {
      beforeEach(() => {})

      async function generateReverseHelper(
        calculated: any,
        expectedRouteTokens: { token: string; amount: bigint }[] = [],
      ) {
        jest.spyOn(feeService, 'getFee').mockReturnValue(0n)
        jest.spyOn(feeService, 'calculateTokens').mockResolvedValue({ calculated })
        feeService.deconvertNormalize = jest.fn().mockImplementation((amount) => {
          return { balance: amount }
        })
        feeService.convertNormalize = jest.fn().mockImplementation((amount) => {
          return { balance: amount }
        })

        const { response: quoteDataEntry } = await quoteService.generateReverseQuote({
          route: {},
          reward: {},
        } as any)
        expect(quoteDataEntry).toBeDefined()
        expect(quoteDataEntry).toHaveProperty('routeTokens')
        expect(quoteDataEntry!.routeTokens).toEqual(expectedRouteTokens)
      }

      it('should subtract fees from tokens that solver needs least', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 50n }],
          tokens: [
            { address: '0x2', balance: 100n },
            { address: '0x3', balance: 200n },
          ],
          calls: [
            { address: '0x2', balance: 100n, recipient: zeroAddress },
            { address: '0x3', balance: 200n, recipient: zeroAddress },
          ],
          destDeficitDescending: [
            {
              delta: {
                address: '0x2',
                balance: -100n,
              },
              token: {},
            },
            {
              delta: {
                address: '0x3',
                balance: -50n,
              },
              token: {},
            },
          ],
        } as any
        await generateReverseHelper(calculated, [{ token: '0x3', amount: 50n }])
      })

      it('should fill deficit that has a call to fill it', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 200n }],
          tokens: [{ address: '0x2', balance: 200n }],
          calls: [{ address: '0x2', balance: 200n, recipient: zeroAddress }],
          destDeficitDescending: [
            { delta: { balance: -100n, address: '0x2' }, token: {} },
            { delta: { balance: -50n, address: '0x3' }, token: {} },
          ],
        } as any

        await generateReverseHelper(calculated, [{ token: '0x2', amount: 200n }])
      })
    })
  })

  describe('on getQuoteExpiryTime', () => {
    it('should return the correct expiry time', async () => {
      const expiryTime = quoteService.getQuoteExpiryTime()
      expect(Number(expiryTime)).toBeGreaterThan(0)
    })
  })
})
