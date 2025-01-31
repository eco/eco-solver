import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeasibilityService } from '@/intent/feasibility.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { ValidationChecks, ValidationService } from '@/intent/validation.sevice'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import {
  InfeasibleQuote,
  InternalSaveError,
  InvalidQuoteIntent,
  SolverUnsupported,
} from '@/quote/errors'
import { QuoteService } from '@/quote/quote.service'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { Model } from 'mongoose'

describe('QuotesService', () => {
  let quoteService: QuoteService
  let liquidityManagerService: DeepMocked<LiquidityManagerService>
  let validationService: DeepMocked<ValidationService>
  let feasibilityService: DeepMocked<FeasibilityService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let quoteModel: DeepMocked<Model<QuoteIntentModel>>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
        { provide: LiquidityManagerService, useValue: createMock<LiquidityManagerService>() },
        { provide: ValidationService, useValue: createMock<ValidationService>() },
        { provide: FeasibilityService, useValue: createMock<FeasibilityService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: getModelToken(QuoteIntentModel.name),
          useValue: createMock<Model<QuoteIntentModel>>(),
        },
      ],
    }).compile()

    quoteService = chainMod.get(QuoteService)

    liquidityManagerService = chainMod.get(LiquidityManagerService)
    validationService = chainMod.get(ValidationService)
    feasibilityService = chainMod.get(FeasibilityService)
    utilsIntentService = chainMod.get(UtilsIntentService)
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

    it('should return the quote', async () => {
      const data = { fee: 1n }
      quoteService.storeQuoteIntentData = jest.fn().mockResolvedValue({})
      quoteService.validateQuoteIntentData = jest.fn().mockResolvedValue(undefined)
      quoteService.generateQuote = jest.fn().mockResolvedValue(data)
      expect(await quoteService.getQuote({} as any)).toEqual(data)
    })
  })

  describe('on storeQuoteIntentData', () => {
    it('should log error if storing fails', async () => {
      const failedStore = new Error('error')
      quoteModel.create = jest.fn().mockRejectedValue(failedStore)
      const r = await quoteService.storeQuoteIntentData({} as any)
      expect(r).toEqual(failedStore)
      expect(mockLogError).toHaveBeenCalled()
    })

    it('should save the DTO and return a record', async () => {
      const data = { fee: 1n }
      quoteModel.create = jest.fn().mockResolvedValue(data)
      const r = await quoteService.storeQuoteIntentData({} as any)
      expect(r).toEqual(data)
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('on validateQuoteIntentData', () => {
    const quoteIntentModel = {
      _id: 'id9',
      route: {
        destination: 1n,
      },
    }
    const validations: ValidationChecks = {
      proverUnsupported: true,
      targetsUnsupported: false,
      selectorsUnsupported: true,
      expiresEarly: false,
      invalidDestination: true,
      sameChainFulfill: true,
    }
    const validValidations: ValidationChecks = {
      proverUnsupported: true,
      targetsUnsupported: true,
      selectorsUnsupported: true,
      expiresEarly: true,
      invalidDestination: true,
      sameChainFulfill: true,
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
      validationService.assertValidations = jest.fn().mockReturnValue(validations)

      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(
        InvalidQuoteIntent(validations),
      )
      expect(mockLogLog).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `validateQuoteIntentData: Some validations failed`,
        quoteIntentModel,
        validations,
      })
      expect(updateQuoteDb).toHaveBeenCalledWith(quoteIntentModel, {
        error: InvalidQuoteIntent(validations),
      })
    })

    it('should return infeasable if the quote is infeasable', async () => {
      const results = { solvent: true, profitable: false } as any
      ecoConfigService.getSolver = jest.fn().mockReturnValue({})
      validationService.assertValidations = jest.fn().mockReturnValue(validValidations)
      feasibilityService.validateExecution = jest
        .fn()
        .mockResolvedValue({ feasable: false, results })
      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(
        InfeasibleQuote(results),
      )
      expect(mockLogLog).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `validateQuoteIntentData: quote intent is not feasable ${quoteIntentModel._id}`,
        quoteIntentModel,
        feasable: false,
      })
      expect(updateQuoteDb).toHaveBeenCalledWith(quoteIntentModel, {
        error: InfeasibleQuote(results),
      })
    })

    it('should return nothing if all the validations pass', async () => {
      ecoConfigService.getSolver = jest.fn().mockReturnValue({})
      validationService.assertValidations = jest.fn().mockReturnValue(validValidations)
      feasibilityService.validateExecution = jest.fn().mockResolvedValue({ feasable: true })
      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(undefined)
      expect(updateQuoteDb).not.toHaveBeenCalled()
    })
  })

  describe('on generateQuote', () => {
    const quoteIntentModel = {
      _id: 'id9',
      route: {
        destination: 1n,
      },
    }
    it('should calculcated quote and call getSolverTokensDescending and getNormalizedTokens', async () => {
      const solver = { '0x1': { tokens: 1n } } as any
      const deficitDescending = 'aasdf' as any
      const cal = 10n
      const nor = 'norm' as any
      const des = jest
        .spyOn(quoteService, 'getSolverTokensDescending')
        .mockResolvedValue({ solver, deficitDescending } as any)
      const norm = jest.spyOn(quoteService, 'getNormalizedTokens').mockReturnValue(nor)
      const calculate = jest.spyOn(quoteService, 'calculateQuote').mockReturnValue(cal as any)
      expect(await quoteService.generateQuote(quoteIntentModel as any)).toEqual(cal)
      expect(des).toHaveBeenCalled()
      expect(norm).toHaveBeenCalled()
      expect(calculate).toHaveBeenCalled()
      expect(des).toHaveBeenCalledWith(quoteIntentModel.route)
      expect(norm).toHaveBeenCalledWith(quoteIntentModel, solver)
      expect(calculate).toHaveBeenCalledWith(quoteIntentModel.route, nor, deficitDescending)
    })

    it('should return the calculcated quote ', async () => {})
  })

  describe('on calculateQuote', () => {
    it('should ', async () => {})

    it('should ', async () => {})

    it('should ', async () => {})

    it('should ', async () => {})

    it('should ', async () => {})
  })

  describe('on getNormalizedTokens', () => {})

  describe('on getSolverTokensDescending', () => {})

  describe('on getFeeMultiplier', () => {
    it('should return the correct fee multiplier', async () => {
      const feeMultiplier = quoteService.getFeeMultiplier({} as any)
      expect(feeMultiplier).toBe(1n)
    })
  })

  describe('on getQuoteExpiryTime', () => {
    it('should return the correct expiry time', async () => {
      const expiryTime = quoteService.getQuoteExpiryTime()
      expect(Number(expiryTime)).toBeGreaterThan(0)
    })
  })

  it('should ', async () => {})
})
