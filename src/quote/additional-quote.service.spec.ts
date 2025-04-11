import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { FeeService } from '@/fee/fee.service'
<<<<<<< HEAD
import { FulfillmentEstimateService } from '@/fulfillment-estimate/fulfillment-estimate.service'
import { InfeasibleQuote, InvalidQuoteIntent } from '@/quote/errors'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { Logger } from '@nestjs/common'
import { parseGwei } from 'viem'
=======
import { InfeasibleQuote, InvalidQuoteIntent } from '@/quote/errors'
import { Logger } from '@nestjs/common'
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteService } from '@/quote/quote.service'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { ValidationService } from '@/intent/validation.sevice'

const logger = new Logger('QuoteServiceSpec')

const mockIsRewardFeasible = jest.fn()
const mockAssertValidations = jest.fn()

describe('QuoteService', () => {
  let quoteService: QuoteService
  let quoteRepository: QuoteRepository
  let feeService: FeeService
  let validationService: ValidationService
<<<<<<< HEAD
  let intentInitiationService: IntentInitiationService
=======
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)

  const quoteTestUtils = new QuoteTestUtils()

  beforeEach(async () => {
    const $ = EcoTester.setupTestFor(QuoteService)
      .withProviders([
        {
          provide: EcoConfigService,
          useValue: {
            getQuotesConfig: () => ({ intentExecutionTypes: ['GASLESS', 'SELF_PUBLISH'] }),
<<<<<<< HEAD
            getGasEstimationsConfig: () => ({
              fundFor: 150_000n,
              permit: 60_000n,
              permit2: 80_000n,
              defaultGasPriceGwei: '30',
            }),
            getSolver: () => ({ targets: { '0xabc': {} } }),
            getSupportedChains: () => [31337],
            getIntentSources: () => [{ chainID: 31337, provers: ['0xprover'] }],
=======
            getSolver: () => ({ targets: { '0xabc': {} } }),
            getSupportedChains: () => [31337],
            getIntentSources: () => [
              { chainID: 31337, provers: ['0xprover'] },
            ],
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
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
<<<<<<< HEAD
        IntentInitiationService,
        FulfillmentEstimateService,
=======
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
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
<<<<<<< HEAD
    intentInitiationService = await $.get(IntentInitiationService)
=======
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
    feeService = await $.get(FeeService)
    validationService = await $.get(ValidationService)
    quoteService.onModuleInit()
  })

  describe('QuoteService - regular quotes & error handling', () => {
<<<<<<< HEAD
=======

>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
    it('should store and generate quote for GASLESS', async () => {
      const model = quoteTestUtils.createQuoteIntentModel({ intentExecutionType: 'GASLESS' })

      jest.spyOn(quoteRepository, 'storeQuoteIntentData').mockResolvedValue({
        response: [model],
      })

      jest.spyOn(feeService, 'isRewardFeasible').mockResolvedValue({})
<<<<<<< HEAD
      jest.spyOn(intentInitiationService, 'getGasPrice').mockResolvedValue(parseGwei('50'))
=======
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)

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
<<<<<<< HEAD
      const mockUpdate = jest
        .spyOn(quoteRepository, 'updateQuoteDb')
        .mockResolvedValue({ response: model })
=======
      const mockUpdate = jest.spyOn(quoteRepository, 'updateQuoteDb').mockResolvedValue({ response: model })
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
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
<<<<<<< HEAD
      jest
        .spyOn(quoteRepository, 'storeQuoteIntentData')
        .mockResolvedValue({ response: [mockIntent] })
=======
      jest.spyOn(quoteRepository, 'storeQuoteIntentData').mockResolvedValue({ response: [mockIntent] })
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
      jest.spyOn(quoteService['ecoConfigService'], 'getSolver').mockReturnValue(undefined)

      const result = await quoteService.getQuote(dto)
      expect(result.error).toBeDefined()
    })

<<<<<<< HEAD
=======
    it('should call generateQuoteForIntentExecutionType for all supported types', async () => {
      const model = quoteTestUtils.createQuoteIntentModel()

      jest.spyOn(quoteService, 'generateQuote').mockResolvedValue({
        response: quoteTestUtils.createQuoteDataEntryDTO(),
      })

      const result = await quoteService.getQuotesForIntentTypes(model)
      expect(result.response!.quoteEntries.length).toBeGreaterThan(0)
    })

>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
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

<<<<<<< HEAD
      const mockUpdate = jest
        .spyOn(quoteRepository, 'updateQuoteDb')
        .mockResolvedValue({ response: model })
=======
      const mockUpdate = jest.spyOn(quoteRepository, 'updateQuoteDb').mockResolvedValue({ response: model })
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
      jest.spyOn(validationService, 'assertValidations').mockResolvedValue(failedValidations)

      const result = await quoteService.getQuote({ ...model, intentExecutionTypes: ['GASLESS'] })

      expect(result.error).toBeDefined()
      expect(result.error![0].name).toBe(InvalidQuoteIntent(failedValidations).name)
      expect(mockUpdate).toHaveBeenCalled()
<<<<<<< HEAD
      expect(mockUpdate).toHaveBeenCalledWith(model, {
        error: InvalidQuoteIntent(failedValidations),
      })
=======
      expect(mockUpdate).toHaveBeenCalledWith(model, { error: InvalidQuoteIntent(failedValidations) })
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
    })
  })

  describe('QuoteService - reverse quotes & error handling', () => {
<<<<<<< HEAD
=======

>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
    it('should generate a reverse quote when route is feasible and valid', async () => {
      const model = quoteTestUtils.createQuoteIntentModel({ intentExecutionType: 'GASLESS' })

      jest.spyOn(quoteRepository, 'storeQuoteIntentData').mockResolvedValue({
        response: [model],
      })

      jest.spyOn(feeService, 'isRewardFeasible').mockResolvedValue({})
<<<<<<< HEAD
      jest.spyOn(intentInitiationService, 'getGasPrice').mockResolvedValue(parseGwei('35'))
=======
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)

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
<<<<<<< HEAD
      const mockUpdate = jest
        .spyOn(quoteRepository, 'updateQuoteDb')
        .mockResolvedValue({ response: model })
      jest.spyOn(quoteService, 'generateReverseQuote').mockResolvedValue({ response: mockEntry })

      const result = await quoteService.getReverseQuote({
        ...model,
        intentExecutionTypes: ['GASLESS'],
      })
=======
      const mockUpdate = jest.spyOn(quoteRepository, 'updateQuoteDb').mockResolvedValue({ response: model })
      jest.spyOn(quoteService, 'generateReverseQuote').mockResolvedValue({ response: mockEntry })

      const result = await quoteService.getReverseQuote({ ...model, intentExecutionTypes: ['GASLESS'] })
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
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

<<<<<<< HEAD
      const mockUpdate = jest
        .spyOn(quoteRepository, 'updateQuoteDb')
        .mockResolvedValue({ response: model })
      jest.spyOn(validationService, 'assertValidations').mockResolvedValue(failedValidations)

      const result = await quoteService.getReverseQuote({
        ...model,
        intentExecutionTypes: ['GASLESS'],
      })
=======
      const mockUpdate = jest.spyOn(quoteRepository, 'updateQuoteDb').mockResolvedValue({ response: model })
      jest.spyOn(validationService, 'assertValidations').mockResolvedValue(failedValidations)

      const result = await quoteService.getReverseQuote({ ...model, intentExecutionTypes: ['GASLESS'] })
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
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
<<<<<<< HEAD

  describe('estimateFlatFee', () => {
    it('should estimate flat fee correctly with 2 reward tokens', async () => {
      const chainID = 1
      const quoteDataEntry = quoteTestUtils.createQuoteDataEntryDTO({
        rewardTokens: [
          { token: '0xToken1', amount: 100n },
          { token: '0xToken2', amount: 200n },
        ],
      })

      const mockGasPrice = parseGwei('35')
      jest.spyOn(intentInitiationService, 'getGasPrice').mockResolvedValue(mockGasPrice)

      const result = await quoteService.estimateFlatFee(chainID, quoteDataEntry)
      const expectedGas = 150_000n + 2n * 80_000n // 310_000
      const expectedFee = expectedGas * mockGasPrice

      expect(result).toBe(expectedFee)
      expect(intentInitiationService.getGasPrice).toHaveBeenCalledWith(chainID, parseGwei('30'))
    })

    it('should default to 0 tokens and just use baseGas if no tokens', async () => {
      const chainID = 1
      const quoteDataEntry = quoteTestUtils.createQuoteDataEntryDTO({
        rewardTokens: [],
      })

      const mockGasPrice = parseGwei('40')
      jest.spyOn(intentInitiationService, 'getGasPrice').mockResolvedValue(mockGasPrice)

      const result = await quoteService.estimateFlatFee(chainID, quoteDataEntry)
      const expectedGas = 150_000n
      const expectedFee = expectedGas * mockGasPrice

      expect(result).toBe(expectedFee)
      expect(intentInitiationService.getGasPrice).toHaveBeenCalled()
    })
  })
=======
>>>>>>> 5df2cf0 ( - Added a QuoteRepository class)
})
