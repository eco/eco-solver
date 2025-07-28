const mockGetTransactionTargetData = jest.fn()
const mockDeconvertNormalize = jest.fn()
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
import { FulfillmentEstimateService } from '@/fulfillment-estimate/fulfillment-estimate.service'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { QuotesConfig } from '@/eco-configs/eco-config.types'
import { zeroAddress } from 'viem'
import { QuoteRepository } from '@/quote/quote.repository'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { PermitValidationService } from '@/intent-initiation/permit-validation/permit-validation.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { Chain, PublicClient, Transport } from 'viem'
import { EcoAnalyticsService } from '@/analytics'
import { UpdateQuoteParams } from '@/quote/interfaces/update-quote-params.interface'
import { EcoError } from '@/common/errors/eco-error'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'

jest.mock('@/intent/utils', () => {
  return {
    ...jest.requireActual('@/intent/utils'),
    getTransactionTargetData: mockGetTransactionTargetData,
  }
})

jest.mock('@/common/utils/normalize', () => {
  return {
    ...jest.requireActual('@/common/utils/normalize'),
    deconvertNormalize: mockDeconvertNormalize,
  }
})

// Create mock wallet client
const walletClient = {
  writeContract: jest.fn().mockResolvedValue('0xTransactionHash'),
  sendTransaction: jest.fn().mockResolvedValue('0xTransactionHash'),
}

// Create mock public client
const publicClient = createMock<PublicClient<Transport, Chain>>({
  chain: { id: 10 },
  waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
})

describe('QuotesService', () => {
  let quoteService: QuoteService
  let quoteRepository: QuoteRepository
  let feeService: DeepMocked<FeeService>
  let validationService: DeepMocked<ValidationService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let quoteModel: DeepMocked<Model<QuoteIntentModel>>
  let fulfillmentEstimateService: DeepMocked<FulfillmentEstimateService>
  let crowdLiquidityService: DeepMocked<CrowdLiquidityService>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()
  const quoteTestUtils = new QuoteTestUtils()
  const mockLogWarn = jest.fn()

  beforeEach(async () => {
    const quotesConfig = { intentExecutionTypes: ['SELF_PUBLISH', 'GASLESS'] }
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
        QuoteRepository,
        IntentInitiationService,
        PermitValidationService,
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: ValidationService, useValue: createMock<ValidationService>() },
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: WalletClientDefaultSignerService,
          useValue: {
            getClient: jest.fn().mockResolvedValue(walletClient),
            getPublicClient: jest.fn().mockResolvedValue(publicClient),
          },
        },
        {
          provide: getModelToken(QuoteIntentModel.name),
          useValue: createMock<Model<QuoteIntentModel>>(),
        },
        { provide: FulfillmentEstimateService, useValue: createMock<FulfillmentEstimateService>() },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
        { provide: CrowdLiquidityService, useValue: createMock<CrowdLiquidityService>() },
      ],
    }).compile()

    quoteService = chainMod.get(QuoteService)
    quoteRepository = chainMod.get(QuoteRepository)
    feeService = chainMod.get(FeeService)
    validationService = chainMod.get(ValidationService)
    crowdLiquidityService = chainMod.get(CrowdLiquidityService)

    ecoConfigService = chainMod.get(EcoConfigService)
    quoteModel = chainMod.get(getModelToken(QuoteIntentModel.name))
    fulfillmentEstimateService = chainMod.get(FulfillmentEstimateService)

    quoteService['logger'].debug = mockLogDebug
    quoteService['logger'].log = mockLogLog
    quoteService['logger'].error = mockLogError
    quoteService['quotesConfig'] = quotesConfig as QuotesConfig

    quoteRepository['logger'].debug = mockLogDebug
    quoteRepository['logger'].log = mockLogLog
    quoteRepository['logger'].error = mockLogError
    quoteRepository['quotesConfig'] = quotesConfig as QuotesConfig
    quoteService['logger'].warn = mockLogWarn
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
    mockLogError.mockClear()
    mockLogWarn.mockClear()
    mockDeconvertNormalize.mockClear()
  })

  describe('on getQuote', () => {
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
      jest.spyOn(quoteRepository, 'storeQuoteIntentData').mockResolvedValue({ error: failedStore })
      const quoteIntent = quoteTestUtils.createQuoteIntentDataDTO()
      const { error } = await quoteService.storeQuoteIntentData(quoteIntent)
      expect(error).toBeDefined()
    })

    it('should save the DTO and return a record', async () => {
      const quoteIntentData = quoteTestUtils.createQuoteIntentDataDTO({
        intentExecutionTypes: [IntentExecutionType.GASLESS.toString()],
      })
      const quoteIntentModel = quoteTestUtils.getQuoteIntentModel(
        quoteIntentData.intentExecutionTypes[0],
        quoteIntentData,
      )
      jest
        .spyOn(quoteRepository, 'storeQuoteIntentData')
        .mockResolvedValue({ response: [quoteIntentModel] })
      const { response: quoteIntentModels } =
        await quoteService.storeQuoteIntentData(quoteIntentData)
      expect(quoteIntentModels).toEqual([quoteIntentModel])
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
      supportedNative: true,
      supportedProver: true,
      supportedTargets: true,
      supportedTransaction: true,
      validTransferLimit: true,
      validExpirationTime: true,
      validDestination: false,
      fulfillOnDifferentChain: true,
      sufficientBalance: true,
    }
    const validValidations: ValidationChecks = {
      supportedNative: true,
      supportedProver: true,
      supportedTargets: true,
      supportedTransaction: true,
      validTransferLimit: true,
      validExpirationTime: true,
      validDestination: true,
      fulfillOnDifferentChain: true,
      sufficientBalance: true,
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
      const ask = { token: calculated.calls.reduce((a, b) => a + b.balance, 0n), native: 10n }
      const totalRewards = { token: 112n, native: 9n }
      jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
      jest.spyOn(feeService, 'getTotalFill').mockResolvedValue({
        totalFillNormalized: ask,
      })
      jest.spyOn(feeService, 'getTotalRewards').mockResolvedValue({
        totalRewardsNormalized: totalRewards,
      })
      const { error } = await quoteService.generateQuote({ route: {} } as any)
      expect(error).toEqual(InsufficientBalance(ask, totalRewards))
    })

    describe('on building quote', () => {
      beforeEach(() => {})

      async function generateHelper(
        calculated: any,
        expectedTokens: { token: string; amount: bigint }[],
        expectedNativeReward?: bigint,
        expectedFulfillTimeSec?: number,
      ) {
        const ask = calculated.calls.reduce(
          (a, b) => {
            return { token: a.token + b.balance, native: a.native + b.native.amount }
          },
          { token: 0n, native: 0n },
        )

        jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
        jest.spyOn(feeService, 'getTotalFill').mockResolvedValue({
          totalFillNormalized: ask,
        })
        jest.spyOn(feeService, 'getTotalRewards').mockResolvedValue({
          totalRewardsNormalized: {
            token: calculated.rewards.reduce((a, b) => a + b.balance, 0n),
            native: expectedNativeReward || 0n,
          },
        })
        jest.spyOn(feeService, 'calculateTokens').mockResolvedValue({ calculated })
        mockDeconvertNormalize.mockImplementation((amount) => {
          return amount
        })

        jest
          .spyOn(fulfillmentEstimateService, 'getEstimatedFulfillTime')
          .mockReturnValue(expectedFulfillTimeSec || 15)

        // Mock the getGasOverhead method
        jest.spyOn(quoteService, 'getGasOverhead').mockReturnValue(145_000)

        const { response: quoteDataEntry } = await quoteService.generateQuote({
          route: { tokens: [], calls: [] },
          reward: {},
        } as any)
        expect(quoteDataEntry).toEqual({
          routeTokens: [],
          routeCalls: [],
          rewardTokens: expectedTokens,
          rewardNative: expectedNativeReward || 0n,
          expiryTime: expect.any(String),
          estimatedFulfillTimeSec: expectedFulfillTimeSec || 15,
          gasOverhead: 145_000,
        })
      }

      it('should fill up the most deficit balance', async () => {
        const calculated = {
          solver: {},
          rewards: [
            { address: '0x1', balance: 100n },
            { address: '0x2', balance: 200n },
          ],
          calls: [{ address: '0x3', balance: 50n, native: { amount: 0n } }],
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
          calls: [{ balance: 150n, native: { amount: 0n } }],
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
          calls: [{ balance: 40n, native: { amount: 0n } }],
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
          calls: [{ balance: 150n, native: { amount: 0n } }],
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
          calls: [{ balance: 150n, native: { amount: 0n } }],
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
          calls: [{ balance: 150n, native: { amount: 0n } }],
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
          calls: [{ balance: 250n, native: { amount: 0n } }],
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
          calls: [{ balance: 250n, native: { amount: 0n } }],
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

      it('should calculate correct time for fulfillment', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x2', balance: 200n }],
          calls: [{ balance: 150n, native: { amount: 0n } }],
          srcDeficitDescending: [
            { delta: { balance: -100n, address: '0x1' } },
            { delta: { balance: -50n, address: '0x2' } },
          ],
        } as any
        await generateHelper(calculated, [{ token: '0x2', amount: 150n }], 0n, 0)
      })

      it('should handle native gas token rewards correctly', async () => {
        const nativeGas = 135n
        const calculated = {
          solver: {},
          rewards: [
            { address: '0x1', balance: 100n },
            { address: '0x2', balance: 200n },
          ],
          calls: [{ balance: 150n, native: { amount: nativeGas } }],
          srcDeficitDescending: [
            { delta: { balance: -50n, address: '0x1' } },
            { delta: { balance: 100n, address: '0x2' } },
          ],
        } as any
        await generateHelper(
          calculated,
          [
            { token: '0x1', amount: 100n },
            { token: '0x2', amount: 50n },
          ],
          nativeGas,
        )
      })

      it('should handle mixed token and native rewards', async () => {
        const nativeGas = 75n
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 50n }],
          calls: [{ balance: 50n, native: { amount: nativeGas } }],
          srcDeficitDescending: [{ delta: { balance: -50n, address: '0x1' } }],
        } as any
        await generateHelper(calculated, [{ token: '0x1', amount: 50n }], nativeGas)
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
      const totalReward = {
        token: calculated.rewards.reduce((acc, reward) => acc + reward.balance, 0n),
        native: 0n,
      }
      const fee = { token: totalReward.token + 1n, native: 0n }
      jest.spyOn(feeService, 'getFee').mockReturnValue(fee)
      jest.spyOn(feeService, 'getTotalRewards').mockResolvedValue({
        totalRewardsNormalized: totalReward,
      })

      const intent = { route: { tokens: [], calls: [] }, reward: {} } as any
      const { error } = await quoteService.generateReverseQuote(intent)
      expect(error).toEqual(InsufficientBalance(fee, totalReward))
    })

    describe('on building reverse quote', () => {
      beforeEach(() => {})

      async function generateReverseHelper(
        calculated: any,
        expectedRouteTokens: { token: string; amount: bigint }[] = [],
        expectedRewardNative?: bigint,
      ) {
        const fee = { token: 0n, native: 10000000n } // Small native fee
        jest.spyOn(feeService, 'getFee').mockReturnValue(fee)
        jest.spyOn(feeService, 'getTotalRewards').mockResolvedValue({
          totalRewardsNormalized: {
            token: calculated.rewards?.reduce((a, b) => a + b.balance, 0n) || 0n,
            native: expectedRewardNative || 100000000n,
          },
        })
        jest.spyOn(feeService, 'calculateTokens').mockResolvedValue({ calculated })
        mockDeconvertNormalize.mockImplementation((amount) => {
          return amount
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
        if (expectedRewardNative !== undefined) {
          expect(quoteDataEntry!.rewardNative).toEqual(expectedRewardNative - fee.native)
        }
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

      it('should handle native gas token in reverse quotes correctly', async () => {
        const nativeGas = 135n
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 100n }],
          tokens: [{ address: '0x2', balance: 150n }],
          calls: [
            {
              address: '0x2',
              balance: 150n,
              recipient: zeroAddress,
              native: { amount: nativeGas },
            },
          ],
          destDeficitDescending: [{ delta: { balance: -50n, address: '0x2' }, token: {} }],
        } as any

        await generateReverseHelper(calculated, [{ token: '0x2', amount: 100n }], 200000000n)
      })

      it('should properly calculate rewardNative after fee deduction', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 50n }],
          tokens: [{ address: '0x2', balance: 100n }],
          calls: [{ address: '0x2', balance: 100n, recipient: zeroAddress }],
          destDeficitDescending: [{ delta: { balance: -25n, address: '0x2' }, token: {} }],
        } as any

        await generateReverseHelper(calculated, [{ token: '0x2', amount: 50n }], 500000000n)
      })
    })
  })

  describe('on getQuoteExpiryTime', () => {
    it('should return the correct expiry time', async () => {
      const expiryTime = quoteService.getQuoteExpiryTime()
      expect(Number(expiryTime)).toBeGreaterThan(0)
    })
  })

  describe('on getGasOverhead', () => {
    const mockQuoteIntentModel = {
      route: {
        source: 1n,
      },
    } as any

    beforeEach(() => {
      // Mock the getIntentConfigs method to return the default gasOverhead
      ecoConfigService.getIntentConfigs = jest.fn().mockReturnValue({
        defaultGasOverhead: 145_000,
      })
    })

    it('should return the gas overhead from solver when available', () => {
      const mockSolver = {
        gasOverhead: 25000,
      }
      ecoConfigService.getSolver = jest.fn().mockReturnValue(mockSolver)

      const result = quoteService.getGasOverhead(mockQuoteIntentModel)

      expect(result).toBe(25000)
      expect(ecoConfigService.getSolver).toHaveBeenCalledWith(mockQuoteIntentModel.route.source)
      expect(mockLogDebug).not.toHaveBeenCalled()
      expect(mockLogError).not.toHaveBeenCalled()
    })

    it('should return default gasOverhead when solver is undefined', () => {
      ecoConfigService.getSolver = jest.fn().mockReturnValue(undefined)

      const result = quoteService.getGasOverhead(mockQuoteIntentModel)

      expect(result).toBe(145_000)
      expect(ecoConfigService.getSolver).toHaveBeenCalledWith(mockQuoteIntentModel.route.source)
      expect(ecoConfigService.getIntentConfigs).toHaveBeenCalled()
      expect(mockLogWarn).not.toHaveBeenCalled()
    })

    it('should return default gasOverhead when solver.gasOverhead is null', () => {
      const mockSolver = {
        gasOverhead: null,
      }
      ecoConfigService.getSolver = jest.fn().mockReturnValue(mockSolver)

      const result = quoteService.getGasOverhead(mockQuoteIntentModel)

      expect(result).toBe(145_000)
      expect(ecoConfigService.getSolver).toHaveBeenCalledWith(mockQuoteIntentModel.route.source)
      expect(ecoConfigService.getIntentConfigs).toHaveBeenCalled()
      expect(mockLogWarn).not.toHaveBeenCalled()
    })

    it('should return default gasOverhead when solver.gasOverhead is undefined', () => {
      const mockSolver = {
        // gasOverhead is undefined
      }
      ecoConfigService.getSolver = jest.fn().mockReturnValue(mockSolver)

      const result = quoteService.getGasOverhead(mockQuoteIntentModel)

      expect(result).toBe(145_000)
      expect(ecoConfigService.getSolver).toHaveBeenCalledWith(mockQuoteIntentModel.route.source)
      expect(ecoConfigService.getIntentConfigs).toHaveBeenCalled()
      expect(mockLogWarn).not.toHaveBeenCalled()
    })

    it('should return default gasOverhead and log warning when solver.gasOverhead is negative', () => {
      const mockSolver = {
        gasOverhead: -5000,
      }
      ecoConfigService.getSolver = jest.fn().mockReturnValue(mockSolver)

      const result = quoteService.getGasOverhead(mockQuoteIntentModel)

      expect(result).toBe(145_000)
      expect(ecoConfigService.getSolver).toHaveBeenCalledWith(mockQuoteIntentModel.route.source)
      expect(ecoConfigService.getIntentConfigs).toHaveBeenCalled()
      expect(mockLogWarn).toHaveBeenCalledWith({
        msg: 'Invalid negative gasOverhead: -5000, using default gas overhead',
        error: 'Error: Gas overhead is negative: -5000',
      })
    })

    it('should return 0 when solver.gasOverhead is 0', () => {
      const mockSolver = {
        gasOverhead: 0,
      }
      ecoConfigService.getSolver = jest.fn().mockReturnValue(mockSolver)

      const result = quoteService.getGasOverhead(mockQuoteIntentModel)

      expect(result).toBe(0)
      expect(ecoConfigService.getSolver).toHaveBeenCalledWith(mockQuoteIntentModel.route.source)
      expect(mockLogWarn).not.toHaveBeenCalled()
    })

    it('should throw error when intentConfigs.defaultGasOverhead is undefined', () => {
      const mockSolver = {
        gasOverhead: null,
      }
      ecoConfigService.getSolver = jest.fn().mockReturnValue(mockSolver)
      ecoConfigService.getIntentConfigs = jest.fn().mockReturnValue({
        // gasOverhead is undefined
      })

      expect(() => quoteService.getGasOverhead(mockQuoteIntentModel)).toThrow(
        'Default gas overhead is undefined',
      )
      expect(mockLogError).toHaveBeenCalledWith({
        msg: 'intentConfigs.defaultGasOverhead is undefined',
        error: 'Error: Default gas overhead is undefined',
      })
    })

    it('should throw error when intentConfigs.defaultGasOverhead is null', () => {
      const mockSolver = {
        gasOverhead: null,
      }
      ecoConfigService.getSolver = jest.fn().mockReturnValue(mockSolver)
      ecoConfigService.getIntentConfigs = jest.fn().mockReturnValue({
        defaultGasOverhead: null,
      })

      expect(() => quoteService.getGasOverhead(mockQuoteIntentModel)).toThrow(
        'Default gas overhead is undefined',
      )
      expect(mockLogError).toHaveBeenCalledWith({
        msg: 'intentConfigs.defaultGasOverhead is undefined',
        error: 'Error: Default gas overhead is undefined',
      })
    })

    it('should work with different default gasOverhead values', () => {
      const customGasOverhead = 50_000
      ecoConfigService.getIntentConfigs = jest.fn().mockReturnValue({
        defaultGasOverhead: customGasOverhead,
      })
      ecoConfigService.getSolver = jest.fn().mockReturnValue(undefined)

      const result = quoteService.getGasOverhead(mockQuoteIntentModel)

      expect(result).toBe(customGasOverhead)
      expect(ecoConfigService.getIntentConfigs).toHaveBeenCalled()
    })
  })

  describe('on updateQuoteDb', () => {
    const _id = 'id9'
    const mockQuoteIntentModelBase = { _id } as unknown as QuoteIntentModel // Base model for updates

    it('should return error if repository fails', async () => {
      const failedStore = new Error('db error')
      jest.spyOn(quoteRepository, 'updateQuoteDb').mockResolvedValue({ error: failedStore })
      const result = await quoteService.updateQuoteDb(mockQuoteIntentModelBase, {
        error: new Error('test error'),
      })
      expect(result.error).toEqual(failedStore)
    })

    it('should call repository with correct parameters and return its response', async () => {
      const quoteIntentModel = quoteTestUtils.createQuoteIntentModel()
      const quoteDataEntry = quoteTestUtils.createQuoteDataEntryDTO()
      const updateParams: UpdateQuoteParams = { quoteDataEntry }

      const updatedDoc = {
        ...quoteIntentModel,
        receipt: { quoteDataEntry },
      } as QuoteIntentModel
      jest.spyOn(quoteRepository, 'updateQuoteDb').mockResolvedValue({ response: updatedDoc })

      const { response, error } = await quoteService.updateQuoteDb(quoteIntentModel, updateParams)

      expect(error).toBeUndefined()
      expect(response).toEqual(updatedDoc)
      expect(quoteRepository.updateQuoteDb).toHaveBeenCalledTimes(1)
      expect(quoteRepository.updateQuoteDb).toHaveBeenCalledWith(quoteIntentModel, updateParams)
    })
  })

  describe('CrowdLiquidity Quotes', () => {
    const quoteIntentData = quoteTestUtils.createQuoteIntentDataDTO({
      intentExecutionTypes: [IntentExecutionType.CROWD_LIQUIDITY.toString()],
    })
    const quoteIntentModel = quoteTestUtils.getQuoteIntentModel(
      quoteIntentData.intentExecutionTypes[0],
      quoteIntentData,
    )

    it('should generate a CrowdLiquidity quote when enabled and eligible', async () => {
      ecoConfigService.getCrowdLiquidity.mockReturnValue({ enabled: true } as any)
      crowdLiquidityService.isRouteSupported.mockReturnValue(true)
      crowdLiquidityService.isPoolSolvent.mockResolvedValue(true)
      jest
        .spyOn(quoteService as any, '_generateCrowdLiquidityQuote')
        .mockResolvedValue({ response: {} })

      const { response, error } = await quoteService['generateQuoteForCrowdLiquidity']({
        quoteIntent: quoteIntentModel,
      } as any)

      expect(error).toBeUndefined()
      expect(response).toBeDefined()
      expect(crowdLiquidityService.isRouteSupported).toHaveBeenCalled()
      expect(crowdLiquidityService.isPoolSolvent).toHaveBeenCalled()
      expect(quoteService['_generateCrowdLiquidityQuote']).toHaveBeenCalled()
    })

    it('should return an error when CL is disabled', async () => {
      ecoConfigService.getCrowdLiquidity.mockReturnValue({ enabled: false } as any)

      const { error } = await quoteService['generateQuoteForCrowdLiquidity']({
        quoteIntent: quoteIntentModel,
      } as any)

      expect(error).toBeDefined()
      expect(error.message).toContain('CrowdLiquidity quoting is disabled')
    })

    it('should return an error when route is not supported by CL', async () => {
      ecoConfigService.getCrowdLiquidity.mockReturnValue({ enabled: true } as any)
      crowdLiquidityService.isRouteSupported.mockReturnValue(false)

      const { error } = await quoteService['generateQuoteForCrowdLiquidity']({
        quoteIntent: quoteIntentModel,
      } as any)

      expect(error).toBeDefined()
      expect(error.message).toContain('Route not supported by CrowdLiquidity')
    })

    it('should return an error when CL pool is not solvent', async () => {
      ecoConfigService.getCrowdLiquidity.mockReturnValue({ enabled: true } as any)
      crowdLiquidityService.isRouteSupported.mockReturnValue(true)
      crowdLiquidityService.isPoolSolvent.mockResolvedValue(false)

      const { error } = await quoteService['generateQuoteForCrowdLiquidity']({
        quoteIntent: quoteIntentModel,
      } as any)

      expect(error).toBeDefined()
      expect(error.message).toContain('CrowdLiquidity pool is not solvent')
    })
  })
})
