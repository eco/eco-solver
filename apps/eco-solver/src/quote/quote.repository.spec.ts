import { EcoConfigService } from '@libs/eco-solver-config'
import { EcoError } from '@eco-solver/common/errors/eco-error'
import { EcoTester } from '@eco-solver/common/test-utils/eco-tester/eco-tester'
import { getModelToken } from '@nestjs/mongoose'
import { QuoteIntentDataDTO } from '@eco-solver/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@eco-solver/quote/schemas/quote-intent.schema'
import { QuoteRepository } from '@eco-solver/quote/quote.repository'
import { QuoteTestUtils } from '@eco-solver/intent-initiation/test-utils/quote-test-utils'
import { UpdateQuoteParams } from '@eco-solver/quote/interfaces/update-quote-params.interface'
import { EcoAnalyticsService } from '@eco-solver/analytics'

describe('QuoteRepository', () => {
  let quoteRepository: QuoteRepository

  const mockCreate = jest.fn()
  const mockFindOne = jest.fn()
  const mockFindOneAndUpdate = jest.fn()
  const mockCountDocuments = jest.fn()
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()

  const mockQuoteIntentModel = {
    create: mockCreate,
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
    countDocuments: mockCountDocuments,
  }

  const mockEcoConfigService = {
    getQuotesConfig: () => ({
      intentExecutionTypes: ['GASLESS', 'SELF_PUBLISH'],
    }),
  }

  const quoteTestUtils = new QuoteTestUtils()

  beforeEach(async () => {
    const $ = EcoTester.setupTestFor(QuoteRepository)
      .withProviders([
        {
          provide: getModelToken(QuoteIntentModel.name),
          useValue: mockQuoteIntentModel,
        },
        {
          provide: EcoConfigService,
          useValue: mockEcoConfigService,
        },
      ])
      .withMocks([EcoAnalyticsService])

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
    jest.restoreAllMocks()
  })

  describe('Storing Quotes', () => {
    describe('Input Validation', () => {
      it('should return validation error for missing quoteID', async () => {
        const mockDTO: QuoteIntentDataDTO = {
          ...quoteTestUtils.createQuoteIntentDataDTO({
            intentExecutionTypes: ['GASLESS'],
          }),
          quoteID: '',
        }

        const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

        expect(response).toBeUndefined()
        expect(error).toBeDefined()
        expect((error as Error).message).toContain('quoteID is required')
        expect(mockCreate).not.toHaveBeenCalled()
      })

      it('should return validation error for missing dAppID', async () => {
        const mockDTO: QuoteIntentDataDTO = {
          ...quoteTestUtils.createQuoteIntentDataDTO({
            intentExecutionTypes: ['GASLESS'],
          }),
          dAppID: '',
        }

        const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

        expect(response).toBeUndefined()
        expect(error).toBeDefined()
        expect((error as Error).message).toContain('dAppID is required')
        expect(mockCreate).not.toHaveBeenCalled()
      })

      it('should return validation error for empty intentExecutionTypes', async () => {
        const mockDTO: QuoteIntentDataDTO = {
          ...quoteTestUtils.createQuoteIntentDataDTO(),
          intentExecutionTypes: [],
        }

        const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

        expect(response).toBeUndefined()
        expect(error).toBeDefined()
        expect((error as Error).message).toContain('intentExecutionTypes must be a non-empty array')
        expect(mockCreate).not.toHaveBeenCalled()
      })

      it('should return validation error for missing route', async () => {
        const mockDTO: any = {
          ...quoteTestUtils.createQuoteIntentDataDTO(),
          route: undefined,
        }

        const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

        expect(response).toBeUndefined()
        expect(error).toBeDefined()
        expect((error as Error).message).toContain('route is required')
        expect(mockCreate).not.toHaveBeenCalled()
      })

      it('should return validation error for missing reward', async () => {
        const mockDTO: any = {
          ...quoteTestUtils.createQuoteIntentDataDTO(),
          reward: undefined,
        }

        const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

        expect(response).toBeUndefined()
        expect(error).toBeDefined()
        expect((error as Error).message).toContain('reward is required')
        expect(mockCreate).not.toHaveBeenCalled()
      })
    })

    describe('Supported Types Filtering', () => {
      it('should return error array if all intent types are unsupported', async () => {
        const mockDTO: QuoteIntentDataDTO = quoteTestUtils.createQuoteIntentDataDTO({
          intentExecutionTypes: ['UNSUPPORTED_TYPE', 'ANOTHER_UNSUPPORTED'],
        })

        const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

        expect(response).toBeUndefined()
        expect(error).toBeDefined()
        expect(Array.isArray(error)).toBe(true)
        expect((error as Error[]).length).toBe(0)
        expect(mockCreate).not.toHaveBeenCalled()
      })

      it('should store only supported intent types and skip unsupported ones', async () => {
        const mockDTO: QuoteIntentDataDTO = quoteTestUtils.createQuoteIntentDataDTO({
          intentExecutionTypes: ['GASLESS', 'UNSUPPORTED_TYPE', 'SELF_PUBLISH'],
        })

        const mockStoredDoc1 = { _id: '123', ...mockDTO, intentExecutionType: 'GASLESS' }
        const mockStoredDoc2 = { _id: '456', ...mockDTO, intentExecutionType: 'SELF_PUBLISH' }
        mockCreate.mockResolvedValueOnce(mockStoredDoc1).mockResolvedValueOnce(mockStoredDoc2)

        const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

        expect(error).toBeUndefined()
        expect(response).toHaveLength(2)
        expect(response![0]._id).toBe('123')
        expect(response![1]._id).toBe('456')
        expect(mockCreate).toHaveBeenCalledTimes(2)
      })
    })

    describe('Database Operations', () => {
      it('should handle database error when storing quote', async () => {
        const dto = quoteTestUtils.createQuoteIntentDataDTO({
          intentExecutionTypes: ['GASLESS'],
        })

        mockCreate.mockRejectedValue(new Error('Database connection failed'))

        const { response, error } = await quoteRepository.storeQuoteIntentData(dto)

        expect(response).toBeUndefined()
        expect(error).toBeDefined()
        expect(Array.isArray(error)).toBe(true)
        expect((error as Error[])[0].message).toContain('Database connection failed')
      })

      it('should handle partial success with some database errors', async () => {
        const dto = quoteTestUtils.createQuoteIntentDataDTO({
          intentExecutionTypes: ['GASLESS', 'SELF_PUBLISH'],
        })

        const mockStoredDoc = { _id: '123', ...dto, intentExecutionType: 'GASLESS' }
        mockCreate
          .mockResolvedValueOnce(mockStoredDoc)
          .mockRejectedValueOnce(new Error('DB error for SELF_PUBLISH'))

        const { response, error } = await quoteRepository.storeQuoteIntentData(dto)

        expect(response).toBeDefined()
        expect(response).toHaveLength(1)
        expect(response![0]._id).toBe('123')
        expect(error).toBeUndefined()
      })

      it('should store quote intent data for valid types', async () => {
        const mockDTO: QuoteIntentDataDTO = quoteTestUtils.createQuoteIntentDataDTO({
          dAppID: 'test-dapp',
          intentExecutionTypes: ['GASLESS'],
        })

        const mockStoredDoc = { _id: '123', ...mockDTO, intentExecutionType: 'GASLESS' }
        mockCreate.mockResolvedValue(mockStoredDoc)

        const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

        expect(error).toBeUndefined()
        expect(response).toHaveLength(1)
        expect(response![0]._id).toBe('123')
        expect(mockCreate).toHaveBeenCalled()
      })

      it('should create immutable copies of route and reward objects', async () => {
        const mockDTO: QuoteIntentDataDTO = quoteTestUtils.createQuoteIntentDataDTO({
          intentExecutionTypes: ['GASLESS'],
        })

        const mockStoredDoc = { _id: '123', intentExecutionType: 'GASLESS' }
        mockCreate.mockResolvedValue(mockStoredDoc)

        await quoteRepository.storeQuoteIntentData(mockDTO)

        const createCall = mockCreate.mock.calls[0][0]
        expect(createCall.route).not.toBe(mockDTO.route)
        expect(createCall.reward).not.toBe(mockDTO.reward)
        expect(createCall.route).toEqual(mockDTO.route)
        expect(createCall.reward).toEqual(mockDTO.reward)
      })
    })
  })

  describe('Fetching Quotes', () => {
    it('should fetch quote intent data from db with lean query', async () => {
      const mockDoc = { _id: 'abc', dAppID: 'xyz' }
      const mockQuery = { dAppID: 'xyz' }

      const mockLeanFindOne = {
        lean: jest.fn().mockResolvedValue(mockDoc),
      }
      mockFindOne.mockReturnValue(mockLeanFindOne)

      const { response, error } = await quoteRepository.fetchQuoteIntentData(mockQuery)

      expect(error).toBeUndefined()
      expect(response).toEqual(mockDoc)
      expect(mockFindOne).toHaveBeenCalledWith(mockQuery)
      expect(mockLeanFindOne.lean).toHaveBeenCalled()
    })

    it('should return error if no quote found', async () => {
      const mockQuery = { dAppID: 'notfound' }
      const mockLeanFindOne = {
        lean: jest.fn().mockResolvedValue(null),
      }
      mockFindOne.mockReturnValue(mockLeanFindOne)

      const { error } = await quoteRepository.fetchQuoteIntentData(mockQuery)

      expect(error).toEqual(EcoError.QuoteNotFound)
    })

    it('should handle database errors when fetching', async () => {
      const mockQuery = { dAppID: 'xyz' }
      const mockLeanFindOne = {
        lean: jest.fn().mockRejectedValue(new Error('Database connection error')),
      }
      mockFindOne.mockReturnValue(mockLeanFindOne)

      const { response, error } = await quoteRepository.fetchQuoteIntentData(mockQuery)

      expect(response).toBeUndefined()
      expect(error).toBeDefined()
      expect((error as Error).message).toContain('Database connection error')
    })

    it('should accept properly typed query filters', async () => {
      const typedQuery = {
        quoteID: 'test-quote-id',
        dAppID: 'test-dapp',
        intentExecutionType: 'GASLESS',
      }

      const mockDoc = { _id: 'abc', ...typedQuery }
      const mockLeanFindOne = {
        lean: jest.fn().mockResolvedValue(mockDoc),
      }
      mockFindOne.mockReturnValue(mockLeanFindOne)

      const { response, error } = await quoteRepository.fetchQuoteIntentData(typedQuery)

      expect(error).toBeUndefined()
      expect(response).toEqual(mockDoc)
      expect(mockFindOne).toHaveBeenCalledWith(typedQuery)
    })
  })

  describe('Quote Existence Check', () => {
    it('should return true if quote exists', async () => {
      const mockQuery = { dAppID: 'xyz' }
      mockCountDocuments.mockResolvedValue(1)

      const exists = await quoteRepository.quoteExists(mockQuery)

      expect(exists).toBe(true)
      expect(mockCountDocuments).toHaveBeenCalledWith(mockQuery)
    })

    it('should return false if quote does not exist', async () => {
      const mockQuery = { dAppID: 'notfound' }
      mockCountDocuments.mockResolvedValue(0)

      const exists = await quoteRepository.quoteExists(mockQuery)

      expect(exists).toBe(false)
      expect(mockCountDocuments).toHaveBeenCalledWith(mockQuery)
    })

    it('should return true if multiple quotes exist', async () => {
      const mockQuery = { intentExecutionType: 'GASLESS' }
      mockCountDocuments.mockResolvedValue(5)

      const exists = await quoteRepository.quoteExists(mockQuery)

      expect(exists).toBe(true)
      expect(mockCountDocuments).toHaveBeenCalledWith(mockQuery)
    })

    it('should return false on database error', async () => {
      const mockQuery = { dAppID: 'xyz' }
      mockCountDocuments.mockRejectedValue(new Error('Database error'))

      const exists = await quoteRepository.quoteExists(mockQuery)

      expect(exists).toBe(false)
      expect(mockLogError).toHaveBeenCalled()
    })
  })

  describe('Updating Quotes', () => {
    describe('Error Updates', () => {
      it('should update quote with error and return updated doc', async () => {
        const mockModel = quoteTestUtils.createQuoteIntentModel()
        const updateParams: UpdateQuoteParams = {
          error: new Error('Processing failed'),
        }
        const updatedDoc = {
          ...mockModel,
          receipt: { error: updateParams.error },
        }

        mockFindOneAndUpdate.mockResolvedValue(updatedDoc)

        const { response, error } = await quoteRepository.updateQuoteDb(
          mockModel as any,
          updateParams,
        )

        expect(error).toBeUndefined()
        expect(response).toEqual(updatedDoc)
        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
          { _id: mockModel._id },
          { $set: { receipt: { error: updateParams.error } } },
          { upsert: false, new: true, lean: true },
        )
      })
    })

    describe('Successful Updates', () => {
      it('should update quote with quote data entry', async () => {
        const quoteIntentModel = quoteTestUtils.createQuoteIntentModel()
        const quoteDataEntry = quoteTestUtils.createQuoteDataEntryDTO()
        const updateParams: UpdateQuoteParams = { quoteDataEntry }

        const expectedRoute = {
          ...quoteIntentModel.route,
          tokens: quoteDataEntry.routeTokens,
          calls: quoteDataEntry.routeCalls,
        }

        const updatedDoc = {
          ...quoteIntentModel,
          route: expectedRoute,
          receipt: { quoteDataEntry },
          reward: {
            ...quoteIntentModel.reward,
            tokens: quoteDataEntry.rewardTokens,
            nativeValue: quoteDataEntry.rewardNative || BigInt(0),
          },
        }

        mockFindOneAndUpdate.mockResolvedValue(updatedDoc)

        const { response, error } = await quoteRepository.updateQuoteDb(
          quoteIntentModel,
          updateParams,
        )

        expect(error).toBeUndefined()
        expect(response).toEqual(updatedDoc)
        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
          { _id: quoteIntentModel._id },
          {
            $set: {
              receipt: { quoteDataEntry },
              route: expectedRoute,
              'reward.tokens': quoteDataEntry.rewardTokens,
              'reward.nativeValue': quoteDataEntry.rewardNative || BigInt(0),
            },
          },
          { upsert: false, new: true, lean: true },
        )
      })

      it('should handle missing rewardNative by defaulting to BigInt(0)', async () => {
        const quoteIntentModel = quoteTestUtils.createQuoteIntentModel()
        const quoteDataEntry = {
          ...quoteTestUtils.createQuoteDataEntryDTO(),
        }
        delete (quoteDataEntry as any).rewardNative

        const updatedDoc = {
          ...quoteIntentModel,
          reward: {
            ...quoteIntentModel.reward,
            nativeValue: BigInt(0),
          },
        }

        mockFindOneAndUpdate.mockResolvedValue(updatedDoc)

        const { response, error } = await quoteRepository.updateQuoteDb(quoteIntentModel, {
          quoteDataEntry,
        })

        expect(error).toBeUndefined()
        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
          { _id: quoteIntentModel._id },
          expect.objectContaining({
            $set: expect.objectContaining({
              'reward.nativeValue': BigInt(0),
            }),
          }),
          { upsert: false, new: true, lean: true },
        )
      })
    })

    describe('Error Handling', () => {
      it('should return error if quote not found during update', async () => {
        const mockModel = quoteTestUtils.createQuoteIntentModel()
        const updateParams: UpdateQuoteParams = {
          quoteDataEntry: quoteTestUtils.createQuoteDataEntryDTO(),
        }

        mockFindOneAndUpdate.mockResolvedValue(null)

        const { response, error } = await quoteRepository.updateQuoteDb(
          mockModel as any,
          updateParams,
        )

        expect(response).toBeUndefined()
        expect(error).toEqual(EcoError.QuoteNotFound)
      })

      it('should handle database errors during update', async () => {
        const mockModel = quoteTestUtils.createQuoteIntentModel()
        const updateParams: UpdateQuoteParams = {
          quoteDataEntry: quoteTestUtils.createQuoteDataEntryDTO(),
        }

        mockFindOneAndUpdate.mockRejectedValue(new Error('Database connection failed'))

        const { response, error } = await quoteRepository.updateQuoteDb(
          mockModel as any,
          updateParams,
        )

        expect(response).toBeUndefined()
        expect(error).toEqual(EcoError.QuoteDBUpdateError)
        expect(mockLogError).toHaveBeenCalled()
      })

      it('should throw error if neither error nor quoteDataEntry is provided', async () => {
        const mockModel = quoteTestUtils.createQuoteIntentModel()
        const updateParams: UpdateQuoteParams = {}

        const { response, error } = await quoteRepository.updateQuoteDb(
          mockModel as any,
          updateParams,
        )

        expect(response).toBeUndefined()
        expect(error).toEqual(EcoError.QuoteDBUpdateError)
      })
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty config for supported types', async () => {
      const mockEcoConfigServiceEmpty = {
        getQuotesConfig: () => ({}),
      }

      const $Empty = EcoTester.setupTestFor(QuoteRepository)
        .withProviders([
          {
            provide: getModelToken(QuoteIntentModel.name),
            useValue: mockQuoteIntentModel,
          },
          {
            provide: EcoConfigService,
            useValue: mockEcoConfigServiceEmpty,
          },
        ])
        .withMocks([EcoAnalyticsService])

      const emptyQuoteRepository = (await $Empty.init()) as QuoteRepository
      emptyQuoteRepository.onModuleInit()

      const mockDTO = quoteTestUtils.createQuoteIntentDataDTO({
        intentExecutionTypes: ['GASLESS'],
      })

      const { response, error } = await emptyQuoteRepository.storeQuoteIntentData(mockDTO)

      expect(response).toBeUndefined()
      expect(error).toBeDefined()
      expect(Array.isArray(error)).toBe(true)
      expect((error as Error[]).length).toBe(0)
    })

    it('should handle multiple validation errors', async () => {
      const invalidDTO: any = {
        quoteID: '',
        dAppID: '',
        intentExecutionTypes: [],
        route: undefined,
        reward: undefined,
      }

      const { response, error } = await quoteRepository.storeQuoteIntentData(invalidDTO)

      expect(response).toBeUndefined()
      expect(error).toBeDefined()
      const errorMessage = (error as Error).message
      expect(errorMessage).toContain('quoteID is required')
      expect(errorMessage).toContain('dAppID is required')
      expect(errorMessage).toContain('intentExecutionTypes must be a non-empty array')
      expect(errorMessage).toContain('route is required')
      expect(errorMessage).toContain('reward is required')
    })

    it('should handle whitespace-only strings in validation', async () => {
      const mockDTO = {
        ...quoteTestUtils.createQuoteIntentDataDTO({
          intentExecutionTypes: ['GASLESS'],
        }),
        quoteID: '   ',
        dAppID: '\t\n  ',
      }

      const { response, error } = await quoteRepository.storeQuoteIntentData(mockDTO)

      expect(response).toBeUndefined()
      expect(error).toBeDefined()
      const errorMessage = (error as Error).message
      expect(errorMessage).toContain('quoteID is required')
      expect(errorMessage).toContain('dAppID is required')
    })

    it('should preserve original objects when creating model data', async () => {
      const originalRoute = { test: 'route' }
      const originalReward = { test: 'reward' }
      const mockDTO = {
        ...quoteTestUtils.createQuoteIntentDataDTO({
          intentExecutionTypes: ['GASLESS'],
        }),
        route: originalRoute,
        reward: originalReward,
      } as any

      mockCreate.mockResolvedValue({ _id: '123' })

      await quoteRepository.storeQuoteIntentData(mockDTO)

      expect(originalRoute).toEqual({ test: 'route' })
      expect(originalReward).toEqual({ test: 'reward' })

      if (mockCreate.mock.calls.length > 0) {
        const createCall = mockCreate.mock.calls[0][0]
        expect(createCall.route).not.toBe(originalRoute)
        expect(createCall.reward).not.toBe(originalReward)
      }
    })
  })
})
