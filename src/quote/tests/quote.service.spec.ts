import { BalanceService, TokenFetchAnalysis } from '@/balance/balance.service'
import { getERC20Selector } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeasibilityService } from '@/intent/feasibility.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { ValidationChecks, ValidationService } from '@/intent/validation.sevice'
import {
  InfeasibleQuote,
  InsolventUnprofitableQuote,
  InsufficientBalance,
  InternalQuoteError,
  InternalSaveError,
  InvalidQuote,
  InvalidQuoteIntent,
  QuoteError,
  SolverUnsupported,
} from '@/quote/errors'
import { BASE_DECIMALS, NormalizedToken, QuoteService } from '@/quote/quote.service'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { Model } from 'mongoose'
import { Hex } from 'viem'

describe('QuotesService', () => {
  let quoteService: QuoteService
  let balanceService: DeepMocked<BalanceService>
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
        { provide: BalanceService, useValue: createMock<BalanceService>() },
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

    balanceService = chainMod.get(BalanceService)
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
      validExpirationTime: true,
      validDestination: false,
      fulfillOnDifferentChain: true,
    }
    const validValidations: ValidationChecks = {
      supportedProver: true,
      supportedTargets: true,
      supportedSelectors: true,
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
      const results = { solvent: true, profitable: true } as any
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

    it('should return invalid if the quote doesnt pass execution checks', async () => {
      const results = false as any
      ecoConfigService.getSolver = jest.fn().mockReturnValue({})
      validationService.assertValidations = jest.fn().mockReturnValue(validValidations)
      feasibilityService.validateExecution = jest
        .fn()
        .mockResolvedValue({ feasable: true, results })
      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(
        InvalidQuote(results),
      )
      expect(mockLogLog).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `validateQuoteIntentData: quote intent is not valid ${quoteIntentModel._id}`,
        quoteIntentModel,
        results,
      })
      expect(updateQuoteDb).toHaveBeenCalledWith(quoteIntentModel, {
        error: InvalidQuote(results),
      })
    })

    it('should return insolvent if the quote is that', async () => {
      let results = [
        { solvent: false, profitable: true },
        { solvent: true, profitable: false },
      ] as any
      ecoConfigService.getSolver = jest.fn().mockReturnValue({})
      validationService.assertValidations = jest.fn().mockReturnValue(validValidations)
      jest
        .spyOn(feasibilityService, 'validateExecution')
        .mockResolvedValue({ feasable: true, results })
      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(
        InsolventUnprofitableQuote(results),
      )
      expect(mockLogLog).toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `validateQuoteIntentData: quote intent is not solvent or profitable ${quoteIntentModel._id}`,
        quoteIntentModel,
        results,
      })
      expect(updateQuoteDb).toHaveBeenCalledWith(quoteIntentModel, {
        error: InsolventUnprofitableQuote(results),
      })

      //check individual insolvent/unprofitable
      for (const r of results) {
        jest
          .spyOn(feasibilityService, 'validateExecution')
          .mockResolvedValue({ feasable: true, results: [r] })
        expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(
          InsolventUnprofitableQuote([r]),
        )
        expect(mockLogLog).toHaveBeenCalled()
        expect(mockLogLog).toHaveBeenCalledWith({
          msg: `validateQuoteIntentData: quote intent is not solvent or profitable ${quoteIntentModel._id}`,
          quoteIntentModel,
          results: [r],
        })
        expect(updateQuoteDb).toHaveBeenCalledWith(quoteIntentModel, {
          error: InsolventUnprofitableQuote([r]),
        })
      }
    })

    it('should return nothing if all the validations pass', async () => {
      ecoConfigService.getSolver = jest.fn().mockReturnValue({})
      validationService.assertValidations = jest.fn().mockReturnValue(validValidations)
      feasibilityService.validateExecution = jest
        .fn()
        .mockResolvedValue({ feasable: true, results: [{ solvent: true, profitable: true }] })
      expect(await quoteService.validateQuoteIntentData(quoteIntentModel as any)).toEqual(undefined)
      expect(updateQuoteDb).not.toHaveBeenCalled()
    })
  })

  describe('on generateQuote', () => {
    it('should return error on calculate tokens failing', async () => {
      const error = new Error('error') as any
      quoteService.calculateTokens = jest.fn().mockResolvedValue({ error } as any)
      expect(await quoteService.generateQuote({} as any)).toEqual(InternalQuoteError(error))
    })

    it('should return an insufficient balance if the reward doesnt meet the ask', async () => {
      const calculated = {
        solver: {},
        rewards: [{ balance: 10n }, { balance: 102n }],
        calls: [{ balance: 280n }, { balance: 102n }],
        deficitDescending: [],
      } as any
      quoteService.calculateTokens = jest.fn().mockResolvedValue(calculated)
      const ask = calculated.calls.reduce((a, b) => a + b.balance, 0n)
      const askMock = jest.spyOn(quoteService, 'getAsk').mockReturnValue(ask)
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
      ) {
        const ask = calculated.calls.reduce((a, b) => a + b.balance, 0n)
        jest.spyOn(quoteService, 'getAsk').mockReturnValue(ask)
        quoteService.calculateTokens = jest.fn().mockResolvedValue(calculated)
        quoteService.deconvertNormalize = jest.fn().mockImplementation((amount) => {
          return { balance: amount }
        })
        expect(await quoteService.generateQuote({ route: {} } as any)).toEqual({
          tokens: expectedTokens,
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
    })
  })

  describe('on calculateTokens', () => {
    const quote = {
      route: {
        source: 10n,
        destination: 11n,
        rewards: [
          {
            address: '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc' as Hex,
            decimals: 8,
            balance: 100_000_000n,
          },
          {
            address: '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29' as Hex,
            decimals: 4,
            balance: 1_000n,
          },
        ],
      },
      reward: {
        tokens: [
          { token: '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc', amount: 10_000_000_000n },
          { token: '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29', amount: 1_000n },
        ],
      },
    } as any
    const solver = {
      face: '123',
    } as any
    const source = {
      chainID: 10n,
      tokens: [
        '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc',
        '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29',
        '0x1',
        '0x2',
        '0x3',
      ],
    } as any

    const balances = [
      {
        balance: {
          address: '0x1',
        },
      },
      {
        balance: {
          address: '0x2',
        },
      },
      {
        balance: {
          address: '0x3',
        },
      },
    ] as any
    it('should return error if source is not found', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([] as any)
      const r = await quoteService.calculateTokens(quote as any)
      expect(r).toEqual({ error: QuoteError.NoIntentSourceForSource(quote.route.source) })
      expect(mockLogError).toHaveBeenCalled()
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: QuoteError.NoIntentSourceForSource(quote.route.source).message,
          error: QuoteError.NoIntentSourceForSource(quote.route.source),
          source: undefined,
        }),
      )
    })

    it('should return error if solver is not found', async () => {
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(undefined)
      const r = await quoteService.calculateTokens(quote as any)
      expect(r).toEqual({ error: QuoteError.NoSolverForDestination(quote.route.destination) })
      expect(mockLogError).toHaveBeenCalled()
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: QuoteError.NoSolverForDestination(quote.route.destination).message,
          error: QuoteError.NoSolverForDestination(quote.route.destination),
          solver: undefined,
        }),
      )
    })

    it('should return error if fetching token data fails', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(undefined as any)
      await expect(quoteService.calculateTokens(quote as any)).rejects.toThrow(
        QuoteError.FetchingCallTokensFailed(quote.route.source),
      )
    })

    it('should calculate the delta for all tokens', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(balances)
      const cal = jest.spyOn(quoteService, 'calculateDelta').mockImplementation((token) => {
        return BigInt(token.balance.address) as any
      })
      const rewards = { rewards: {} } as any
      const rew = jest.spyOn(quoteService, 'getRewardsNormalized').mockReturnValue(rewards)
      const calls = { calls: {} } as any
      const call = jest.spyOn(quoteService, 'getCallsNormalized').mockReturnValue(calls)
      const deficitDescending = balances.map((balance) => {
        return { ...balance, delta: BigInt(balance.balance.address) }
      })
      expect(await quoteService.calculateTokens(quote as any)).toEqual({
        solver,
        rewards,
        calls,
        deficitDescending,
      })
      expect(cal).toHaveBeenCalledTimes(balances.length)
      expect(rew).toHaveBeenCalledTimes(1)
      expect(call).toHaveBeenCalledTimes(1)
    })
  })

  describe('on getRewardsNormalized', () => {
    const quote = {
      route: {
        source: 10n,
        destination: 11n,
        rewards: [
          {
            address: '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc' as Hex,
            decimals: 8,
            balance: 100_000_000n,
          },
          {
            address: '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29' as Hex,
            decimals: 4,
            balance: 1_000n,
          },
        ],
      },
      reward: {
        tokens: [
          { token: '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc', amount: 10_000_000_000n },
          { token: '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29', amount: 1_000n },
        ],
      },
    } as any

    const erc20Rewards = {
      '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc': {
        address: '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc',
        decimals: 8,
        balance: 10_000_000_000n,
      },
      '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29': {
        address: '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29',
        decimals: 4,
        balance: 1_000n,
      },
    } as any

    it('should fetch reward tokens from balance service', async () => {
      const mockBalance = jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue({})
      await quoteService.getRewardsNormalized(quote as any)
      expect(mockBalance).toHaveBeenCalledTimes(1)
      expect(mockBalance).toHaveBeenCalledWith(
        Number(quote.route.source),
        quote.reward.tokens.map((reward) => reward.token),
      )
    })

    it('should map rewards and convertNormalize the output', async () => {
      jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue(erc20Rewards)
      const convert = jest.spyOn(quoteService, 'convertNormalize')
      expect(await quoteService.getRewardsNormalized(quote as any)).toEqual([
        {
          chainID: quote.route.source,
          address: '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc',
          decimals: 6,
          balance: 100_000_000n,
        },
        {
          chainID: quote.route.source,
          address: '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29',
          decimals: 6,
          balance: 100_000n,
        },
      ])
      expect(convert).toHaveBeenCalledTimes(2)
    })
  })

  describe('on getCallsNormalized', () => {
    const quote = {
      route: {
        destination: 1n,
        calls: [
          { target: '0x1' as Hex, selector: '0x2' as Hex, data: '0x3' as Hex },
          { target: '0x4' as Hex, selector: '0x5' as Hex, data: '0x6' as Hex },
        ],
      },
    }

    const solver = {
      chainID: 1n,
    } as any

    it('should throw if a solver cant be found', async () => {
      const mockSolver = jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(undefined)
      await expect(quoteService.getCallsNormalized(quote as any)).rejects.toThrow(
        QuoteError.NoSolverForDestination(quote.route.destination),
      )
      expect(mockSolver).toHaveBeenCalledTimes(1)
    })

    it('should throw an error if the balances call fails', async () => {
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solver)
      const mockBalance = jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue({})
      await expect(quoteService.getCallsNormalized(quote as any)).rejects.toThrow(
        QuoteError.FetchingCallTokensFailed(BigInt(solver.chainID)),
      )
      expect(mockBalance).toHaveBeenCalledTimes(1)
      expect(mockBalance).toHaveBeenCalledWith(solver.chainID, expect.any(Array))
    })

    describe('on route calls mapping', () => {
      const callBalances = {
        '0x1': {
          address: '0x1',
          decimals: 6,
          balance: 100_000_000n,
        },
        '0x4': {
          address: '0x4',
          decimals: 4,
          balance: 100_000_000n,
        },
      } as any
      const transferAmount = 10n
      const txTargetData = {
        targetConfig: {
          contractType: 'erc20',
        },
        decodedFunctionData: {
          args: [0, transferAmount],
        },
      } as any
      beforeEach(() => {})

      it('should throw an error if tx target data is not for an erc20 transfer', async () => {
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solver)
        jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue(callBalances)
        const getTTd = jest
          .spyOn(utilsIntentService, 'getTransactionTargetData')
          .mockReturnValue(null)
        const isErc20 = jest.spyOn(utilsIntentService, 'isERC20Target').mockReturnValue(false)
        await expect(quoteService.getCallsNormalized(quote as any)).rejects.toThrow(
          QuoteError.NonERC20TargetInCalls(),
        )
        expect(getTTd).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledWith({
          msg: QuoteError.NonERC20TargetInCalls().message,
          call: quote.route.calls[0],
          error: QuoteError.NonERC20TargetInCalls(),
          ttd: null,
        })
        expect(isErc20).toHaveBeenCalledTimes(1)
        expect(isErc20).toHaveBeenCalledWith(null, getERC20Selector('transfer'))
      })

      it('should throw if the call target is not in the fetched balances', async () => {
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solver)
        jest
          .spyOn(balanceService, 'fetchTokenBalances')
          .mockResolvedValue({ '0x4': callBalances['0x4'] })
        jest.spyOn(utilsIntentService, 'getTransactionTargetData').mockReturnValue(txTargetData)
        jest.spyOn(utilsIntentService, 'isERC20Target').mockReturnValue(true)
        await expect(quoteService.getCallsNormalized(quote as any)).rejects.toThrow(
          QuoteError.FailedToFetchTarget(solver.chainID, quote.route.calls[0].target),
        )
      })

      it('should convert an normalize the erc20 calls', async () => {
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solver)
        jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue(callBalances)
        jest.spyOn(utilsIntentService, 'getTransactionTargetData').mockReturnValue(txTargetData)
        jest.spyOn(utilsIntentService, 'isERC20Target').mockReturnValue(true)
        const convert = jest.spyOn(quoteService, 'convertNormalize')
        expect(await quoteService.getCallsNormalized(quote as any)).toEqual([
          {
            balance: transferAmount,
            chainID: solver.chainID,
            address: '0x1',
            decimals: BASE_DECIMALS,
          },
          {
            balance: transferAmount * 10n ** 2n,
            chainID: solver.chainID,
            address: '0x4',
            decimals: BASE_DECIMALS,
          },
        ])
        expect(convert).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('on getAsk', () => {
    it('should return the correct ask for less than $100', async () => {
      const ask = quoteService.getAsk(1_000_000n, {} as any)
      expect(ask).toBe(1_020_000n)
    })

    it('should return the correct ask for multiples of $100', async () => {
      expect(quoteService.getAsk(99_000_000n, {} as any)).toBe(99_020_000n)
      expect(quoteService.getAsk(100_000_000n, {} as any)).toBe(100_035_000n)
      expect(quoteService.getAsk(999_000_000n, {} as any)).toBe(999_155_000n)
      expect(quoteService.getAsk(1_000_000_000n, {} as any)).toBe(1000_170_000n)
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
    it('should return error if db save fails', async () => {
      const failedStore = new Error('error')
      jest.spyOn(quoteModel, 'updateOne').mockRejectedValue(failedStore)
      const r = await quoteService.updateQuoteDb({ _id } as any)
      expect(r).toEqual(failedStore)
      expect(mockLogError).toHaveBeenCalled()
    })

    it('should save the DTO', async () => {
      const data = { fee: 1n }
      jest.spyOn(quoteModel, 'updateOne').mockResolvedValue(data as any)
      const r = await quoteService.updateQuoteDb({ _id } as any)
      expect(r).toBeUndefined()
      expect(mockLogError).not.toHaveBeenCalled()
      expect(jest.spyOn(quoteModel, 'updateOne')).toHaveBeenCalledWith({ _id }, { _id })
    })

    it('should save the DTO with a reciept', async () => {
      const data = { fee: 1n }
      const receipt = 'receipt'
      jest.spyOn(quoteModel, 'updateOne').mockResolvedValue(data as any)
      const r = await quoteService.updateQuoteDb({ _id, receipt } as any)
      expect(r).toBeUndefined()
      expect(mockLogError).not.toHaveBeenCalled()
      expect(jest.spyOn(quoteModel, 'updateOne')).toHaveBeenCalledWith({ _id }, { _id, receipt })
    })
  })

  describe('on calculateDelta', () => {
    let token: TokenFetchAnalysis
    beforeEach(() => {
      token = {
        config: {
          address: '0x1',
          chainId: 10,
          minBalance: 200,
          targetBalance: 500,
          type: 'erc20',
        },
        balance: {
          address: '0x1',
          decimals: BASE_DECIMALS,
          balance: 300_000_000n,
        },
        chainId: 10,
      }
    })
    it('should calculate the delta for surplus', async () => {
      const convertNormalizeSpy = jest.spyOn(quoteService, 'convertNormalize')
      const normToken = quoteService.calculateDelta(token)
      const expectedNorm: NormalizedToken = {
        balance: 100_000_000n,
        chainID: BigInt(token.chainId),
        address: token.config.address,
        decimals: token.balance.decimals,
      }
      expect(normToken).toEqual(expectedNorm)

      expect(convertNormalizeSpy).toHaveBeenCalledTimes(1)
      expect(convertNormalizeSpy).toHaveBeenCalledWith(100_000_000n, expect.any(Object))
    })

    it('should calculate the delta for deficit', async () => {
      const convertNormalizeSpy = jest.spyOn(quoteService, 'convertNormalize')
      token.balance.balance = 100_000_000n
      const normToken = quoteService.calculateDelta(token)
      const expectedNorm: NormalizedToken = {
        balance: -100_000_000n,
        chainID: BigInt(token.chainId),
        address: token.config.address,
        decimals: token.balance.decimals,
      }
      expect(normToken).toEqual(expectedNorm)

      expect(convertNormalizeSpy).toHaveBeenCalledTimes(1)
      expect(convertNormalizeSpy).toHaveBeenCalledWith(-100_000_000n, expect.any(Object))
    })

    it('should call correct normalization', async () => {
      token.balance.decimals = 4
      token.balance.balance = token.balance.balance / 10n ** 2n
      const convertNormalizeSpy = jest.spyOn(quoteService, 'convertNormalize')
      const normToken = quoteService.calculateDelta(token)
      const expectedNorm: NormalizedToken = {
        balance: 100_000_000n, //300 - 200 = 100 base 6 decimals
        chainID: BigInt(token.chainId),
        address: token.config.address,
        decimals: BASE_DECIMALS,
      }
      expect(normToken).toEqual(expectedNorm)

      expect(convertNormalizeSpy).toHaveBeenCalledTimes(1)
      expect(convertNormalizeSpy).toHaveBeenCalledWith(1_000_000n, expect.any(Object)) // 100 base 4
    })
  })

  describe('on convertNormalize', () => {
    it('should normalize the output', async () => {
      const orig = { chainID: 1n, address: '0x' as Hex, decimals: 6 }
      expect(quoteService.convertNormalize(100n, orig)).toEqual({ balance: 100n, ...orig })
      const second = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      expect(quoteService.convertNormalize(100n, second)).toEqual({
        balance: 10000n,
        ...second,
        decimals: 6,
      })
    })

    it('should change the decimals to the normalized value', async () => {
      const second = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      expect(quoteService.convertNormalize(100n, second)).toEqual({
        balance: 10000n,
        ...second,
        decimals: 6,
      })
    })
  })

  describe('on deconvertNormalize', () => {
    it('should denormalize the output', async () => {
      const orig = { chainID: 1n, address: '0x' as Hex, decimals: 6 }
      expect(quoteService.deconvertNormalize(100n, orig)).toEqual({ balance: 100n, ...orig })
      const second = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      expect(quoteService.deconvertNormalize(100n, second)).toEqual({ balance: 1n, ...second })
    })
  })
})
