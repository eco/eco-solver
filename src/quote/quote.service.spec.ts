import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { FeeService } from '@/fee/fee.service'
import { getModelToken } from '@nestjs/mongoose'
import { InternalQuoteError, SolverUnsupported } from '@/quote/errors'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteService } from '@/quote/quote.service'
import { QuoteTestUtils } from '../intent-initiation/test-utils/quote-test-utils'
import { Solver } from '../eco-configs/eco-config.types'
import { ValidationService } from '@/intent/validation.sevice'

const quoteTestUtils = new QuoteTestUtils()
const MockSolver = {} as Solver

let $: EcoTester
let service: QuoteService
let mockFeeService: FeeService
let mockValidationService: ValidationService
let mockEcoConfigService: EcoConfigService
let mockModel: any

describe('QuoteService', () => {
  beforeAll(async () => {
    const mockSource = {
      getConfig: () => ({
        'IntentSource.1': '0x0000000000000000000000000000000000000001',
        'Prover.1': '0x0000000000000000000000000000000000000002',
        'HyperProver.1': '0x0000000000000000000000000000000000000003',
        'Inbox.1': '0x0000000000000000000000000000000000000004',
        alchemy: {
          networks: [{ id: 1 }, { id: 137 }],
          apiKey: 'fake-alchemy-api-key',
        },
        eth: {
          pollingInterval: 1000,
        },
      }),
    }

    $ = EcoTester.setupTestFor(QuoteService)
      .withProviders([
        {
          provide: getModelToken(QuoteIntentModel.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: EcoConfigService, // ⬅ inject the actual mocked provider here
          useValue: new EcoConfigService([mockSource as any]),
        },
      ])
      .withMocks([
        FeeService,
        ValidationService,
      ])

    service = await $.init()
    mockFeeService = $.get(FeeService)
    mockValidationService = $.get(ValidationService)
    mockEcoConfigService = $.get(EcoConfigService)
    mockModel = $.get(getModelToken(QuoteIntentModel.name))
  })

  it('should store a quote intent successfully', async () => {
    const dto = {} as QuoteIntentDataDTO
    const mockRecord = quoteTestUtils.createQuoteIntentModel()
    mockModel.create.mockResolvedValue(mockRecord)

    const result = await service.storeQuoteIntentData(dto)
    expect(result).toEqual(mockRecord)
  })

  it('should return error when storing quote intent fails', async () => {
    const dto = {} as QuoteIntentDataDTO
    const mockErr = new Error('boom')
    mockModel.create.mockRejectedValue(mockErr)

    const result = await service.storeQuoteIntentData(dto)
    expect(result).toBe(mockErr)
  })

  it('should return SolverUnsupported when no solver found', async () => {
    const quoteIntent = quoteTestUtils.createQuoteIntentModel()
    jest.spyOn(mockEcoConfigService, 'getSolver').mockReturnValue(undefined)

    const result = await service.validateQuoteIntentData(quoteIntent)
    expect(result).toBe(SolverUnsupported)
  })

  it('should return validation error if validations fail', async () => {
    const quoteIntent = quoteTestUtils.createQuoteIntentModel()
    const validations = {
      supportedProver: false,
      supportedSelectors: true,
      supportedTargets: true,
      validTransferLimit: true,
      validExpirationTime: true,
      validDestination: true,
      fulfillOnDifferentChain: true,
    }
    jest.spyOn(mockEcoConfigService, 'getSolver').mockReturnValue(MockSolver)
    mockValidationService.assertValidations = jest.fn().mockResolvedValue(validations)

    const result = await service.validateQuoteIntentData(quoteIntent)
    expect(result?.message).toBe('Bad Request: The quote was deemed invalid.')
  })

  it('should return error if route is infeasible', async () => {
    const quoteIntent = quoteTestUtils.createQuoteIntentModel()
    jest.spyOn(mockEcoConfigService, 'getSolver').mockReturnValue(MockSolver)
    mockValidationService.assertValidations = jest.fn().mockResolvedValue({
      supportedProver: true,
      supportedSelectors: true,
      supportedTargets: true,
      validTransferLimit: true,
      validExpirationTime: true,
      validDestination: true,
      fulfillOnDifferentChain: true,
    })
    mockFeeService.isRouteFeasible = jest.fn().mockResolvedValue({
      error: new Error('infeasible'),
    })

    const result = await service.validateQuoteIntentData(quoteIntent)
    expect(result?.message).toContain('infeasible')
  })

  it('should return quote from getQuotesForIntentTypes if one passes', async () => {
    const quoteIntent = quoteTestUtils.createQuoteIntentModel()
    service['quotesConfig'] = { intentExecutionTypes: ['GASLESS'] }

    jest
      .spyOn(service as any, 'generateQuoteForIntentExecutionType')
      .mockResolvedValue({ response: { intentExecutionType: 'GASLESS', tokens: [], expiryTime: '123' } })

    const { response } = await service.getQuotesForIntentTypes(quoteIntent)
    expect(response!.quoteEntries).toHaveLength(1)
  })

  it('should return error if no quote entries could be generated', async () => {
    const quoteIntent = quoteTestUtils.createQuoteIntentModel()
    service['quotesConfig'] = { intentExecutionTypes: ['GASLESS'] }

    jest
      .spyOn(service as any, 'generateQuoteForIntentExecutionType')
      .mockResolvedValue({ error: InternalQuoteError(new Error('bad')) })

    const { error } = await service.getQuotesForIntentTypes(quoteIntent)
    expect(error?.message).toContain('Failed generate quote')
  })

  it('should return insufficient balance if ask > reward', async () => {
    const quoteIntent = quoteTestUtils.createQuoteIntentModel()
    mockFeeService.calculateTokens = jest.fn().mockResolvedValue({
      calculated: {
        deficitDescending: [],
        calls: [{ balance: 1000n }],
        rewards: [{ address: '0x1', balance: 500n }],
      },
    })

    mockFeeService.getAsk = () => 1200n
    mockFeeService.deconvertNormalize = (amount) => ({ balance: amount } as any)

    const { error } = await service.generateQuote(quoteIntent)
    expect(error?.message).toContain('insufficient')
  })

  it('should update quote intent model in DB', async () => {
    const quoteIntent = quoteTestUtils.createQuoteIntentModel()
    mockModel.updateOne.mockResolvedValue({})

    await service.updateQuoteDb(quoteIntent)
    expect(mockModel.updateOne).toHaveBeenCalled()
  })

  it('should return expiry time in the future', () => {
    const expiry = service.getQuoteExpiryTime()
    expect(Number(expiry)).toBeGreaterThan(Date.now() / 1000)
  })
})
