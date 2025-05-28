import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { FeeService } from '@/fee/fee.service'
import { InfeasibleQuote, InvalidQuoteIntent } from '@/quote/errors'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteService } from '@/quote/quote.service'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { ValidationService } from '@/intent/validation.sevice'

const mockIsRewardFeasible = jest.fn()
const mockAssertValidations = jest.fn()

describe('QuoteService', () => {
  let quoteService: QuoteService
  let quoteRepository: QuoteRepository
  let feeService: FeeService
  let validationService: ValidationService

  const quoteTestUtils = new QuoteTestUtils()

  beforeEach(async () => {
    const $ = EcoTester.setupTestFor(QuoteService)
      .withProviders([
        {
          provide: EcoConfigService,
          useValue: {
            getQuotesConfig: () => ({ intentExecutionTypes: ['GASLESS', 'SELF_PUBLISH'] }),
            getSolver: () => ({ targets: { '0xabc': {} } }),
            getSupportedChains: () => [31337],
            getIntentSources: () => [{ chainID: 31337, provers: ['0xprover'] }],
          },
        },
        {
          provide: FeeService,
          useValue: {
            isRewardFeasible: mockIsRewardFeasible,
            isRouteFeasible: mockIsRewardFeasible,
            calculateTokens: jest.fn(),
            getAsk: jest.fn(() => 1n),
            getFee: jest.fn(() => 1n),
            getTotalFill: jest.fn(() => ({ totalFillNormalized: 1n })),
            getFeeConfig: jest.fn(() => ({ limitFillBase6: 1000000n })),
            deconvertNormalize: jest.fn((val) => ({ balance: val })),
            convertNormalize: jest.fn((val) => ({ balance: val })),
          },
        },
        {
          provide: ValidationService,
          useValue: {
            assertValidations: mockAssertValidations,
          },
        },
      ])
      .withMocks([
        IntentInitiationService,
        QuoteRepository,
        {
          provide: EcoConfigService,
          useValue: {
            getQuotesConfig: () => ({
              intentExecutionTypes: ['GASLESS', 'SELF_PUBLISH'],
            }),
            getSolver: () => ({ chainID: 31337 }), // basic stub
          },
        },
      ])

    quoteService = await $.init()
    quoteRepository = await $.get(QuoteRepository)
    feeService = await $.get(FeeService)
    validationService = await $.get(ValidationService)
  })

  describe('QuoteService - regular quotes & error handling', () => {
    it('should store and generate quote for GASLESS', async () => {
      const model = quoteTestUtils.createQuoteIntentModel({ intentExecutionType: 'GASLESS' })

      jest.spyOn(quoteRepository, 'storeQuoteIntentData').mockResolvedValue({
        response: [model],
      })

      jest.spyOn(feeService, 'isRewardFeasible').mockResolvedValue({})

      const successfulValidations = {
        supportedProver: true,
        supportedTargets: true,
        supportedSelectors: true,
        validTransferLimit: true,
        validExpirationTime: true,
        validDestination: true,
        fulfillOnDifferentChain: true,
      }

      jest.spyOn(validationService, 'assertValidations').mockResolvedValue(successfulValidations)

      const mockEntry = quoteTestUtils.createQuoteDataEntryDTO()
      const mockUpdate = jest
        .spyOn(quoteRepository, 'updateQuoteDb')
        .mockResolvedValue({ response: model })
      jest.spyOn(quoteService, 'generateQuote').mockResolvedValue({ response: mockEntry })

      const result = await quoteService.getQuote({ ...model, intentExecutionTypes: ['GASLESS'] })
      expect(result.response!.quoteEntries.length).toBe(1)
      expect(result.response!.quoteEntries[0]).toEqual(mockEntry)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalledWith(model, { quoteDataEntry: mockEntry })
    })

    it('should return quote validation error if solver is not found', async () => {
      const dto = quoteTestUtils.createQuoteIntentDataDTO({
        intentExecutionTypes: ['GASLESS'],
      })
      const mockIntent = quoteTestUtils.createQuoteIntentModel()
      jest
        .spyOn(quoteRepository, 'storeQuoteIntentData')
        .mockResolvedValue({ response: [mockIntent] })
      jest.spyOn(quoteService['ecoConfigService'], 'getSolver').mockReturnValue(undefined)

      const result = await quoteService.getQuote(dto)
      expect(result.error).toBeDefined()
    })

    it('should return InvalidQuoteIntent error when validations fail', async () => {
      const model = quoteTestUtils.createQuoteIntentModel()

      jest.spyOn(quoteRepository, 'storeQuoteIntentData').mockResolvedValue({
        response: [model],
      })

      const failedValidations = {
        supportedProver: false,
        supportedTargets: true,
        supportedSelectors: true,
        validTransferLimit: true,
        validExpirationTime: true,
        validDestination: true,
        fulfillOnDifferentChain: true,
      }

      const mockUpdate = jest
        .spyOn(quoteRepository, 'updateQuoteDb')
        .mockResolvedValue({ response: model })
      jest.spyOn(validationService, 'assertValidations').mockResolvedValue(failedValidations)

      const result = await quoteService.getQuote({ ...model, intentExecutionTypes: ['GASLESS'] })

      expect(result.error).toBeDefined()
      expect(result.error![0].name).toBe(InvalidQuoteIntent(failedValidations).name)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalledWith(model, {
        error: InvalidQuoteIntent(failedValidations),
      })
    })
  })

  describe('QuoteService - reverse quotes & error handling', () => {
    it('should generate a reverse quote when route is feasible and valid', async () => {
      const model = quoteTestUtils.createQuoteIntentModel({ intentExecutionType: 'GASLESS' })

      jest.spyOn(quoteRepository, 'storeQuoteIntentData').mockResolvedValue({
        response: [model],
      })

      jest.spyOn(feeService, 'isRewardFeasible').mockResolvedValue({})

      const successfulValidations = {
        supportedProver: true,
        supportedTargets: true,
        supportedSelectors: true,
        validTransferLimit: true,
        validExpirationTime: true,
        validDestination: true,
        fulfillOnDifferentChain: true,
      }

      jest.spyOn(validationService, 'assertValidations').mockResolvedValue(successfulValidations)

      const mockEntry = quoteTestUtils.createQuoteDataEntryDTO()
      const mockUpdate = jest
        .spyOn(quoteRepository, 'updateQuoteDb')
        .mockResolvedValue({ response: model })
      jest.spyOn(quoteService, 'generateReverseQuote').mockResolvedValue({ response: mockEntry })

      const result = await quoteService.getReverseQuote({
        ...model,
        intentExecutionTypes: ['GASLESS'],
      })
      expect(result.response!.quoteEntries.length).toBe(1)
      expect(result.response!.quoteEntries[0]).toEqual(mockEntry)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalledWith(model, { quoteDataEntry: mockEntry })
    })

    it('should return InfeasibleQuote error when reward route is not feasible', async () => {
      const model = quoteTestUtils.createQuoteIntentModel()

      jest.spyOn(quoteRepository, 'storeQuoteIntentData').mockResolvedValue({
        response: [model],
      })

      const error = new Error('not enough tokens')

      jest.spyOn(feeService, 'isRewardFeasible').mockResolvedValue({ error })

      const failedValidations = {
        supportedProver: true,
        supportedTargets: true,
        supportedSelectors: true,
        validTransferLimit: true,
        validExpirationTime: true,
        validDestination: true,
        fulfillOnDifferentChain: true,
      }

      const mockUpdate = jest
        .spyOn(quoteRepository, 'updateQuoteDb')
        .mockResolvedValue({ response: model })
      jest.spyOn(validationService, 'assertValidations').mockResolvedValue(failedValidations)

      const result = await quoteService.getReverseQuote({
        ...model,
        intentExecutionTypes: ['GASLESS'],
      })
      expect(result.error![0].name).toBe(InfeasibleQuote(error).name)
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalledWith(model, { error: InfeasibleQuote(error) })
    })
  })

  describe('validateQuoteIntentData', () => {
    it('should return InvalidQuoteIntent error if validations fail', async () => {
      const quoteIntent = quoteTestUtils.createQuoteIntentModel()
      mockAssertValidations.mockResolvedValue({
        supportedProver: true,
        supportedTargets: false,
        supportedSelectors: true,
        validTransferLimit: true,
        validExpirationTime: true,
        validDestination: true,
        fulfillOnDifferentChain: true,
      })

      const error = await quoteService.validateQuoteIntentData(quoteIntent)
      expect(error).toEqual(InvalidQuoteIntent(expect.any(Object)))
    })

    it('should return InfeasibleQuote error if feasibility fails', async () => {
      const quoteIntent = quoteTestUtils.createQuoteIntentModel()
      mockAssertValidations.mockResolvedValue({
        supportedProver: true,
        supportedTargets: true,
        supportedSelectors: true,
        validTransferLimit: true,
        validExpirationTime: true,
        validDestination: true,
        fulfillOnDifferentChain: true,
      })

      mockIsRewardFeasible.mockResolvedValue({ error: new Error('not feasible') })

      const error = await quoteService.validateQuoteIntentData(quoteIntent)
      expect(error).toEqual(InfeasibleQuote(expect.any(Error)))
    })
  })
})
