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

jest.mock('@/intent/utils', () => {
  return {
    ...jest.requireActual('@/intent/utils'),
    getTransactionTargetData: mockGetTransactionTargetData,
  }
})

describe('QuotesService', () => {
  let quoteService: QuoteService
  let feeService: DeepMocked<FeeService>
  let validationService: DeepMocked<ValidationService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let quoteModel: DeepMocked<Model<QuoteIntentModel>>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
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
    feeService = chainMod.get(FeeService)
    validationService = chainMod.get(ValidationService)

    ecoConfigService = chainMod.get(EcoConfigService)
    quoteModel = chainMod.get(getModelToken(QuoteIntentModel.name))

    quoteService['logger'].debug = mockLogDebug
    quoteService['logger'].log = mockLogLog
    quoteService['logger'].error = mockLogError
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
      quoteService.storeQuoteIntentData = jest.fn().mockResolvedValue(failedStore)
      expect(await quoteService.getQuote({} as any)).toEqual(InternalSaveError(failedStore))
    })

    it('should return a 400 if it fails to validate the quote data', async () => {
      quoteService.storeQuoteIntentData = jest.fn().mockResolvedValue({})
      quoteService.validateQuoteIntentData = jest.fn().mockResolvedValue(SolverUnsupported)
      expect(await quoteService.getQuote({} as any)).toEqual(SolverUnsupported)
    })

    it('should save any error in getting the quote to the db', async () => {
      const failedStore = new Error('error')
      quoteService.storeQuoteIntentData = jest.fn().mockResolvedValue(quoteIntent)
      quoteService.validateQuoteIntentData = jest.fn().mockResolvedValue(undefined)
      quoteService.generateQuote = jest.fn().mockImplementation(() => {
        throw failedStore
      })
      const mockDb = jest.spyOn(quoteService, 'updateQuoteDb')
      expect(await quoteService.getQuote({} as any)).toEqual(InternalQuoteError(failedStore))
      expect(mockDb).toHaveBeenCalled()
      expect(mockDb).toHaveBeenCalledWith(quoteIntent, InternalQuoteError(failedStore))
    })

    it('should return the quote', async () => {
      const quoteReciept = { fee: 1n }
      quoteService.storeQuoteIntentData = jest.fn().mockResolvedValue(quoteIntent)
      quoteService.validateQuoteIntentData = jest.fn().mockResolvedValue(undefined)
      quoteService.generateQuote = jest.fn().mockResolvedValue(quoteReciept)
      const mockDb = jest.spyOn(quoteService, 'updateQuoteDb')
      expect(await quoteService.getQuote({} as any)).toEqual(quoteReciept)
      expect(mockDb).toHaveBeenCalled()
      expect(mockDb).toHaveBeenCalledWith(quoteIntent, quoteReciept)
    })
  })

  describe('on storeQuoteIntentData', () => {
    it('should log error if storing fails', async () => {
      const failedStore = new Error('error')
      jest.spyOn(quoteModel, 'create').mockRejectedValue(failedStore)
      const r = await quoteService.storeQuoteIntentData({} as any)
      expect(r).toEqual(failedStore)
      expect(mockLogError).toHaveBeenCalled()
    })

    it('should save the DTO and return a record', async () => {
      const data = { fee: 1n }
      jest.spyOn(quoteModel, 'create').mockResolvedValue(data as any)
      const r = await quoteService.storeQuoteIntentData({} as any)
      expect(r).toEqual(data)
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
      expect(await quoteService.generateQuote({} as any)).toEqual(InternalQuoteError(error))
    })

    it('should return error on calculate tokens doesnt return the calculated tokens', async () => {
      feeService.calculateTokens = jest.fn().mockResolvedValue({ calculated: undefined } as any)
      expect(await quoteService.generateQuote({} as any)).toEqual(InternalQuoteError(undefined))
    })

    it('should return an insufficient balance if the reward doesnt meet the ask', async () => {
      const calculated = {
        solver: {},
        rewards: [{ balance: 10n }, { balance: 102n }],
        calls: [{ balance: 280n }, { balance: 102n }],
        deficitDescending: [],
      } as any
      jest.spyOn(feeService, 'calculateTokens').mockResolvedValue({ calculated })
      const ask = calculated.calls.reduce((a, b) => a + b.balance, 0n)
      const askMock = jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
      expect(await quoteService.generateQuote({ route: {} } as any)).toEqual(
        InsufficientBalance(ask, 112n),
      )
      expect(askMock).toHaveBeenCalled()
    })

    describe('on building quote', () => {
      beforeEach(() => {})

      async function generateHelper(
        calculated: any,
        expectedTokens: { token: string; amount: bigint }[],
        mockOverrides: {
          avgBlockTime?: number | null
          paddingSeconds?: number | null
          blockTimePercentile?: number | null
          solverDefined?: boolean
        } = {},
      ) {
        const {
          avgBlockTime = 12,
          paddingSeconds = 0.5,
          solverDefined = true,
          blockTimePercentile = 0.5,
        } = mockOverrides

        const ask = calculated.calls.reduce((a, b) => a + b.balance, 0n)
        jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
        jest.spyOn(feeService, 'calculateTokens').mockResolvedValue({ calculated })
        feeService.deconvertNormalize = jest.fn().mockImplementation((amount) => {
          return { balance: amount }
        })

        const mockIntentConfigs =
          paddingSeconds === null || blockTimePercentile === null
            ? undefined
            : { executionPaddingSeconds: paddingSeconds, blockTimePercentile }
        jest.spyOn(ecoConfigService, 'getIntentConfigs').mockReturnValue(mockIntentConfigs as any)

        const mockSolver = !solverDefined
          ? undefined
          : avgBlockTime === null
            ? {}
            : { averageBlockTime: avgBlockTime }
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(mockSolver as any)

        const effectiveAvgTime = !solverDefined || avgBlockTime === null ? 15 : avgBlockTime
        const effectivePadding = paddingSeconds === null ? 0.1 : paddingSeconds
        const effectiveBlockTimePercentile =
          blockTimePercentile === null ? 0.5 : blockTimePercentile
        const expectedFulfillTime =
          effectiveAvgTime * effectiveBlockTimePercentile + effectivePadding

        expect(await quoteService.generateQuote({ route: { destination: 1 } } as any)).toEqual({
          tokens: expectedTokens,
          expiryTime: expect.any(String),
          estimatedFulfillTimeSec: expectedFulfillTime,
        })
      }

      it('should fill up the most deficit balance', async () => {
        const calculated = {
          solver: {},
          rewards: [
            { address: '0x1', balance: 100n },
            { address: '0x2', balance: 200n },
          ],
          calls: [{ balance: 50n }],
          deficitDescending: [
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
          deficitDescending: [
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
          deficitDescending: [
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
          deficitDescending: [
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
          deficitDescending: [
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
          deficitDescending: [
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
          deficitDescending: [
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
          deficitDescending: [
            { delta: { balance: 10n, address: '0x1' } },
            { delta: { balance: 20n, address: '0x2' } },
          ],
        } as any
        await generateHelper(calculated, [
          { token: '0x1', amount: 150n },
          { token: '0x2', amount: 100n },
        ])
      })

      it('should calculate correct time for Ethereum-like chain (avgTime=12, padding=3) (Test Case 6)', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 100n }],
          calls: [{ balance: 50n }],
          deficitDescending: [{ delta: { balance: 10n, address: '0x1' } }],
        } as any
        await generateHelper(calculated, [{ token: '0x1', amount: 50n }], {
          avgBlockTime: 12,
          paddingSeconds: 3,
          blockTimePercentile: 0.5,
        })
      })

      it('should calculate correct time for Arbitrum-like chain (avgTime=2, padding=3) (Test Case 7)', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 100n }],
          calls: [{ balance: 50n }],
          deficitDescending: [{ delta: { balance: 10n, address: '0x1' } }],
        } as any
        await generateHelper(calculated, [{ token: '0x1', amount: 50n }], {
          avgBlockTime: 2,
          paddingSeconds: 3,
          blockTimePercentile: 0.5,
        })
      })

      it('should calculate correct time with default padding (padding=null -> 0.1, avgTime=12) (Test Case 8)', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 100n }],
          calls: [{ balance: 50n }],
          deficitDescending: [{ delta: { balance: 10n, address: '0x1' } }],
        } as any
        await generateHelper(calculated, [{ token: '0x1', amount: 50n }], {
          avgBlockTime: 12,
          paddingSeconds: null,
          blockTimePercentile: 0.5,
        })
      })

      it('should calculate correct time with undefined solver (solver=undef -> avgTime=15, padding=3) (Test Case 9a)', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 100n }],
          calls: [{ balance: 50n }],
          deficitDescending: [{ delta: { balance: 10n, address: '0x1' } }],
        } as any
        await generateHelper(calculated, [{ token: '0x1', amount: 50n }], {
          solverDefined: false,
          paddingSeconds: 3,
          blockTimePercentile: 0.5,
        })
      })

      it('should calculate correct time with solver missing avgTime (avgTime=null -> 15, padding=3) (Test Case 9b)', async () => {
        const calculated = {
          solver: {},
          rewards: [{ address: '0x1', balance: 100n }],
          calls: [{ balance: 50n }],
          deficitDescending: [{ delta: { balance: 10n, address: '0x1' } }],
        } as any
        await generateHelper(calculated, [{ token: '0x1', amount: 50n }], {
          avgBlockTime: null,
          paddingSeconds: 3,
          blockTimePercentile: 0.5,
        })
      })
    })
  })

  describe('on getQuoteExpiryTime', () => {
    it('should return the correct expiry time', async () => {
      const expiryTime = quoteService.getQuoteExpiryTime()
      expect(Number(expiryTime)).toBeGreaterThan(0)
    })
  })

  describe('on updateQuoteDb', () => {
    const _id = 'id9'
    const mockQuoteIntentModelBase = { _id } as unknown as QuoteIntentModel // Base model for updates

    it('should return error if db save fails', async () => {
      const failedStore = new Error('error')
      jest.spyOn(quoteModel, 'updateOne').mockRejectedValue(failedStore)
      const r = await quoteService.updateQuoteDb(mockQuoteIntentModelBase as any)
      expect(r).toEqual(failedStore)
      expect(mockLogError).toHaveBeenCalled()
    })

    it('should save the DTO without a receipt if none provided', async () => {
      const data = { fee: 1n }
      jest.spyOn(quoteModel, 'updateOne').mockResolvedValue(data as any)
      const r = await quoteService.updateQuoteDb(mockQuoteIntentModelBase as any)
      expect(r).toBeUndefined()
      expect(mockLogError).not.toHaveBeenCalled()
      // Check that it's called with the model that doesn't have .receipt explicitly set by this call
      const expectedModel = { ...mockQuoteIntentModelBase }
      delete expectedModel.receipt // Ensure receipt is not on the model passed to updateOne if not provided
      expect(jest.spyOn(quoteModel, 'updateOne')).toHaveBeenCalledWith(
        { _id },
        expect.objectContaining({ _id: _id }),
      )
      // More precise check: Ensure the model passed to updateOne doesn't have .receipt if not provided by the call
      const callArgs = (jest.spyOn(quoteModel, 'updateOne').mock.calls[0] as any)[1]
      expect(callArgs.receipt).toBeUndefined()
    })

    it('should save the DTO with a full quote response object as receipt', async () => {
      const data = { fee: 1n } // Mock db response
      const fullQuoteResponseAsReceipt = {
        tokens: [{ token: '0xabc', amount: 123n }],
        expiryTime: '1700000000',
        estimatedFulfillTimeSec: 15,
      }

      jest.spyOn(quoteModel, 'updateOne').mockResolvedValue(data as any)

      const quoteIntentModelForTest = { _id: 'id9' }

      // Call the function with the simplified model, casting to 'any' to bypass strict type checking
      const r = await quoteService.updateQuoteDb(
        quoteIntentModelForTest as any,
        fullQuoteResponseAsReceipt,
      )
      expect(r).toBeUndefined()
      expect(mockLogError).not.toHaveBeenCalled()

      expect(jest.spyOn(quoteModel, 'updateOne')).toHaveBeenCalledTimes(1)

      const updateCallArgs = jest.spyOn(quoteModel, 'updateOne').mock.calls[0] as any
      const filterArg = updateCallArgs[0]
      const modelPassedToUpdate = updateCallArgs[1]

      expect(filterArg._id).toEqual('id9')
      expect(modelPassedToUpdate._id).toEqual('id9')
      expect(modelPassedToUpdate.receipt).toBeDefined()
      expect(modelPassedToUpdate.receipt).toEqual(fullQuoteResponseAsReceipt)
    })
  })
})
