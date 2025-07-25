const mockGetTransactionTargetData = jest.fn()
const mockIsERC20Target = jest.fn()
import { BalanceService, TokenFetchAnalysis } from '@/balance/balance.service'
import { getERC20Selector } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeeConfigType } from '@/eco-configs/eco-config.types'
import { BASE_DECIMALS, FeeService } from '@/fee/fee.service'
import { NormalizedToken, NormalizedTotal } from '@/fee/types'
import { QuoteError } from '@/quote/errors'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { Hex } from 'viem'
import * as _ from 'lodash'
import { EcoAnalyticsService } from '@/analytics'

function getFeeConfig(): FeeConfigType {
  return {
    limit: {
      tokenBase6: 1000n * 10n ** 6n,
      nativeBase18: 1n * 10n ** 18n,
    },
    algorithm: 'linear',
  } as FeeConfigType
}

jest.mock('@/intent/utils', () => {
  return {
    ...jest.requireActual('@/intent/utils'),
    getTransactionTargetData: mockGetTransactionTargetData,
  }
})

jest.mock('@/contracts', () => {
  return {
    ...jest.requireActual('@/contracts'),
    isERC20Target: mockIsERC20Target,
  }
})

describe('FeeService', () => {
  let feeService: FeeService
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()
  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        FeeService,
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
      ],
    }).compile()

    feeService = chainMod.get(FeeService)

    balanceService = chainMod.get(BalanceService)
    ecoConfigService = chainMod.get(EcoConfigService)

    feeService['logger'].debug = mockLogDebug
    feeService['logger'].log = mockLogLog
    feeService['logger'].error = mockLogError
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
    mockLogError.mockClear()
  })

  const defaultFee: FeeConfigType<'linear'> = {
    limit: {
      tokenBase6: 1000n * 10n ** 6n,
      nativeBase18: 1000n * 10n ** 18n,
    },
    algorithm: 'linear',
    constants: {
      token: {
        baseFee: 20_000n,
        tranche: {
          unitFee: 15_000n,
          unitSize: 100_000_000n,
        },
      },
      native: {
        baseFee: 6_000n,
        tranche: {
          unitFee: 5_000n,
          unitSize: 30_000_000n,
        },
      },
    },
  }

  const linearSolver = {
    fee: defaultFee,
  } as any

  describe('on onModuleInit', () => {
    it('should set the config defaults', async () => {
      const whitelist = { '0x1': { '10': getFeeConfig() } }
      expect(feeService['intentConfigs']).toBeUndefined()
      expect(feeService['whitelist']).toBeUndefined()
      const mockGetIntentConfig = jest.spyOn(ecoConfigService, 'getIntentConfigs').mockReturnValue({
        defaultFee,
      } as any)
      const mockGetWhitelist = jest
        .spyOn(ecoConfigService, 'getWhitelist')
        .mockReturnValue(whitelist as any)
      await feeService.onModuleInit()
      expect(feeService['intentConfigs']['defaultFee']).toEqual(defaultFee)
      expect(feeService['whitelist']).toEqual(whitelist)
      expect(mockGetIntentConfig).toHaveBeenCalledTimes(1)
      expect(mockGetWhitelist).toHaveBeenCalledTimes(1)
    })
  })

  describe('on getFeeConfig', () => {
    const creator = '0x1'
    const source = 10
    const intent = {
      reward: {
        creator,
      },
      route: {
        source,
      },
    } as any

    beforeEach(() => {
      feeService['intentConfigs'] = { defaultFee } as any
      feeService['getAskRouteDestinationSolver'] = jest.fn().mockReturnValue({ fee: defaultFee })
    })

    it('should return the default fee if no intent in arguments', async () => {
      expect(feeService.getFeeConfig()).toEqual(defaultFee)
    })

    it('should set the default fee if its passed in as argument', async () => {
      const argFee = getFeeConfig()
      expect(feeService.getFeeConfig({ defaultFeeArg: argFee })).toEqual(argFee)
    })

    it('should return the default fee for the solver if intent is set', async () => {
      const solverFee = { limit: 123n, constants: {} } as any
      feeService['whitelist'] = {}
      feeService['intentConfigs'] = { defaultFee: { limit: 333n } } as any
      feeService['getAskRouteDestinationSolver'] = jest.fn().mockReturnValue({ fee: solverFee })
      expect(feeService.getFeeConfig({ intent })).toEqual(solverFee)
    })

    it('should return the default fee if no special fee for creator', async () => {
      feeService['whitelist'] = {}
      expect(feeService.getFeeConfig({ intent })).toEqual(defaultFee)
    })

    it('should return the default fee if creator special fee is empty', async () => {
      feeService['whitelist'] = { [creator]: {} }
      expect(feeService.getFeeConfig({ intent })).toEqual(defaultFee)
    })

    it('should return the source chain creator default fee, merged, if no chain specific one and its not complete', async () => {
      const creatorDefault = getFeeConfig() as any
      feeService['whitelist'] = { [creator]: { default: creatorDefault } }
      expect(feeService.getFeeConfig({ intent })).toEqual(_.merge({}, defaultFee, creatorDefault))
    })

    it('should return the source chain creator default fee without merge if its complete', async () => {
      const creatorDefault = {
        limit: {
          tokenBase6: 10n,
          nativeBase18: 20n,
        },
        algorithm: 'linear',
        constants: {
          token: {
            baseFee: 2n,
            tranche: {
              unitFee: 3n,
              unitSize: 4n,
            },
          },
          native: {
            baseFee: 5n,
            tranche: {
              unitFee: 6n,
              unitSize: 7n,
            },
          },
        },
      } as any
      feeService['whitelist'] = { [creator]: { default: creatorDefault } }
      expect(feeService.getFeeConfig({ intent })).toEqual(creatorDefault)
    })

    it('should return the source chain specific fee for a creator', async () => {
      const chainConfig = { constants: { tranche: { unitFee: 9911n } } } as any
      const creatorDefault = getFeeConfig() as any
      feeService['whitelist'] = { [creator]: { [source]: chainConfig, default: creatorDefault } }
      expect(feeService.getFeeConfig({ intent })).toEqual(
        _.merge({}, defaultFee, creatorDefault, chainConfig),
      )
    })
  })

  describe('on getAsk', () => {
    const route = {
      destination: 8452n,
      source: 10n,
    } as any

    const reward = {
      reward: {},
    } as any

    const intent = {
      route,
      reward,
    } as any
    const defaultAsk = { token: 1_000_000n, native: 0n }
    describe('on invalid solver', () => {
      it('should throw if no solver found', async () => {
        const getSolver = jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(undefined)
        expect(() => feeService.getAsk(defaultAsk, intent)).toThrow(
          QuoteError.NoSolverForDestination(route.destination),
        )
        expect(getSolver).toHaveBeenCalledTimes(1)
      })

      it('should throw when solver doesnt have a supported algorithm', async () => {
        const solver = {
          fee: {
            ...defaultFee,
            algorithm: 'unsupported',
          },
        } as any

        const getSolver = jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solver)
        jest.spyOn(feeService, 'getFeeConfig').mockReturnValue(solver.fee)
        expect(() => feeService.getAsk(defaultAsk, intent)).toThrow(
          QuoteError.InvalidSolverAlgorithm(route.destination, solver.fee.algorithm),
        )
        expect(getSolver).toHaveBeenCalledTimes(1)
      })
    })

    describe('on linear fee algorithm', () => {
      let solverSpy: jest.SpyInstance
      let feeSpy: jest.SpyInstance
      beforeEach(() => {
        solverSpy = jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
        feeSpy = jest.spyOn(feeService, 'getFeeConfig').mockReturnValue(linearSolver.fee)
      })

      it('should return only tokens if no native', async () => {
        const { token } = linearSolver.fee.constants
        const ask = feeService.getAsk({ token: 1_000_000n, native: 0n }, intent)
        expect(ask).toEqual({
          native: 0n,
          token: 1_000_000n + token.baseFee + 1n * token.tranche.unitFee,
        })
      })

      it('should return only native if no tokens', async () => {
        const { native } = linearSolver.fee.constants
        const ask = feeService.getAsk({ token: 0n, native: 1_000_000n }, intent)
        expect(ask).toEqual({
          native: 1_000_000n + native.baseFee + 1n * native.tranche.unitFee,
          token: 0n,
        })
      })

      it('should return both tokens and native for a mixed intent', async () => {
        const { native, token } = linearSolver.fee.constants
        const ask = feeService.getAsk({ token: 500_000n, native: 1_000_000n }, intent)
        expect(ask).toEqual({
          native: 1_000_000n + native.baseFee + 1n * native.tranche.unitFee,
          token: 500_000n + token.baseFee + 1n * token.tranche.unitFee,
        })
      })

      it('should return the correct ask for less than $100', async () => {
        const { token, native } = linearSolver.fee.constants
        const ask = feeService.getAsk(defaultAsk, intent)
        expect(ask).toEqual({
          native: 0n,
          token: 1_000_000n + token.baseFee + 1n * token.tranche.unitFee,
        })
      })

      it('should return the correct ask for multiples of $100', async () => {
        const {
          token: {
            baseFee,
            tranche: { unitFee },
          },
        } = linearSolver.fee.constants
        //0-100 should have defaultFee
        expect(feeService.getAsk({ token: 99_000_000n, native: 0n }, intent)).toEqual({
          token: 99_000_000n + baseFee + 1n * unitFee,
          native: 0n,
        })
        expect(feeService.getAsk({ token: 100_000_000n, native: 0n }, intent)).toEqual({
          token: 100_000_000n + baseFee + 1n * unitFee,
          native: 0n,
        })
        expect(feeService.getAsk({ token: 999_000_000n, native: 0n }, intent)).toEqual({
          token: 999_000_000n + baseFee + 10n * unitFee,
          native: 0n,
        })
        expect(feeService.getAsk({ token: 1_000_000_000n, native: 0n }, intent)).toEqual({
          token: 1_000_000_000n + baseFee + 10n * unitFee,
          native: 0n,
        })
      })

      it('should correctly handle division precision with small numbers', async () => {
        const {
          token: {
            baseFee,
            tranche: { unitFee },
          },
        } = linearSolver.fee.constants

        expect(feeService.getAsk({ token: 1n, native: 0n }, intent)).toEqual({
          token: 1n + baseFee + 1n * unitFee,
          native: 0n,
        })
        expect(feeService.getAsk({ token: 10n, native: 0n }, intent)).toEqual({
          token: 10n + baseFee + 1n * unitFee,
          native: 0n,
        })
        expect(feeService.getAsk({ token: 100n, native: 0n }, intent)).toEqual({
          token: 100n + baseFee + 1n * unitFee,
          native: 0n,
        })
      })

      it('should handle division with non-divisible amounts correctly', async () => {
        const {
          token: {
            baseFee,
            tranche: { unitFee },
          },
        } = linearSolver.fee.constants

        expect(feeService.getAsk({ token: 50_000_000n, native: 0n }, intent)).toEqual({
          token: 50_000_000n + baseFee + 1n * unitFee,
          native: 0n,
        })
        expect(feeService.getAsk({ token: 33_333_333n, native: 0n }, intent)).toEqual({
          token: 33_333_333n + baseFee + 1n * unitFee,
          native: 0n,
        })
      })

      it('should correctly calculate fee for very small amounts', async () => {
        const {
          token: {
            baseFee,
            tranche: { unitFee },
          },
        } = linearSolver.fee.constants

        // Testing with small amounts that would be affected by division-before-multiplication
        expect(feeService.getAsk({ token: 7n, native: 0n }, intent)).toEqual({
          token: 7n + baseFee + 1n * unitFee,
          native: 0n,
        })
      })
    })
  })

  describe('on isRouteFeasible', () => {
    let quote: any

    const totalRewardsNormalized: NormalizedTotal = { token: 3n, native: 4n }
    const totalFillNormalized: NormalizedTotal = { token: 10n, native: 7n }
    const error = { error: 'error' } as any
    beforeEach(() => {
      quote = {
        route: {
          calls: [{}],
        },
        reward: {
          tokens: [],
        },
      }
    })

    it('should return an error if route has more than 1 call', async () => {
      quote.route.calls.push({})
      expect(await feeService.isRouteFeasible(quote)).toEqual({
        error: QuoteError.MultiFulfillRoute(),
      })
    })

    it('should return an error if reward tokens have duplicates', async () => {
      quote.reward = {
        tokens: [
          { token: '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc', amount: 1000n },
          { token: '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29', amount: 2000n },
          { token: '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc', amount: 3000n },
        ],
      }
      expect(await feeService.isRouteFeasible(quote)).toEqual({
        error: QuoteError.DuplicatedRewardToken(),
      })
    })

    it('should allow unique reward tokens', async () => {
      quote.reward = {
        tokens: [
          { token: '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc', amount: 1000n },
          { token: '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29', amount: 2000n },
        ],
      }
      const getTotallFill = jest.spyOn(feeService, 'getTotalFill').mockResolvedValue({
        totalFillNormalized: totalFillNormalized,
        error: undefined,
      })
      const getTotalRewards = jest.spyOn(feeService, 'getTotalRewards').mockResolvedValue({
        totalRewardsNormalized: totalRewardsNormalized,
        error: undefined,
      })
      const getAsk = jest.spyOn(feeService, 'getAsk').mockReturnValue(totalRewardsNormalized)

      expect(await feeService.isRouteFeasible(quote)).toEqual({ error: undefined })
      expect(getTotallFill).toHaveBeenCalled()
      expect(getTotalRewards).toHaveBeenCalled()
      expect(getAsk).toHaveBeenCalled()
    })

    it('should return an error if getTotalFill fails', async () => {
      const getTotallFill = jest.spyOn(feeService, 'getTotalFill').mockResolvedValue(error)
      expect(await feeService.isRouteFeasible(quote)).toEqual(error)
      expect(getTotallFill).toHaveBeenCalledTimes(1)
    })

    it('should return an error if getTotalRewards fails', async () => {
      jest
        .spyOn(feeService, 'getTotalFill')
        .mockResolvedValue({ totalFillNormalized, error: undefined })
      const getTotalRewards = jest.spyOn(feeService, 'getTotalRewards').mockResolvedValue(error)
      expect(await feeService.isRouteFeasible(quote)).toEqual(error)
      expect(getTotalRewards).toHaveBeenCalledTimes(1)
    })

    it('should return an error if the reward native is less than the ask native', async () => {
      jest
        .spyOn(feeService, 'getTotalFill')
        .mockResolvedValue({ totalFillNormalized, error: undefined })
      jest
        .spyOn(feeService, 'getTotalRewards')
        .mockResolvedValue({ totalRewardsNormalized, error: undefined })
      const ask: NormalizedTotal = {
        token: totalRewardsNormalized.token,
        native: totalRewardsNormalized.native + 1n,
      }
      const getAsk = jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
      expect(await feeService.isRouteFeasible(quote)).toEqual({
        error: QuoteError.RouteIsInfeasable(ask, totalRewardsNormalized),
      })
      expect(getAsk).toHaveBeenCalledTimes(1)
    })

    it('should return an error if the reward token is less than the ask token', async () => {
      jest
        .spyOn(feeService, 'getTotalFill')
        .mockResolvedValue({ totalFillNormalized, error: undefined })
      jest
        .spyOn(feeService, 'getTotalRewards')
        .mockResolvedValue({ totalRewardsNormalized, error: undefined })
      const ask: NormalizedTotal = {
        token: totalRewardsNormalized.token + 1n,
        native: totalRewardsNormalized.native,
      }
      const getAsk = jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
      expect(await feeService.isRouteFeasible(quote)).toEqual({
        error: QuoteError.RouteIsInfeasable(ask, totalRewardsNormalized),
      })
      expect(getAsk).toHaveBeenCalledTimes(1)
    })

    it('should return an error if the ask token and native is less than the reward token and native', async () => {
      jest
        .spyOn(feeService, 'getTotalFill')
        .mockResolvedValue({ totalFillNormalized, error: undefined })
      jest
        .spyOn(feeService, 'getTotalRewards')
        .mockResolvedValue({ totalRewardsNormalized, error: undefined })
      const ask: NormalizedTotal = {
        token: totalRewardsNormalized.token + 1n,
        native: totalRewardsNormalized.native + 1n,
      }
      const getAsk = jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
      expect(await feeService.isRouteFeasible(quote)).toEqual({
        error: QuoteError.RouteIsInfeasable(ask, totalRewardsNormalized),
      })
      expect(getAsk).toHaveBeenCalledTimes(1)
    })

    it('should return an undefined error if the routes reward is equal to the ask', async () => {
      jest
        .spyOn(feeService, 'getTotalFill')
        .mockResolvedValue({ totalFillNormalized, error: undefined })
      jest
        .spyOn(feeService, 'getTotalRewards')
        .mockResolvedValue({ totalRewardsNormalized, error: undefined })
      const ask: NormalizedTotal = {
        token: totalRewardsNormalized.token,
        native: totalRewardsNormalized.native,
      }
      const getAsk = jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
      expect(await feeService.isRouteFeasible(quote)).toEqual({ error: undefined })
      expect(getAsk).toHaveBeenCalledTimes(1)
    })
  })

  describe('on getTotalFill', () => {
    const emptyFill: NormalizedTotal = { native: 0n, token: 0n }
    it('should return an error upstream from getCallsNormalized', async () => {
      const error = { error: 'error' }
      const getCallsNormalized = jest
        .spyOn(feeService, 'getCallsNormalized')
        .mockResolvedValue(error as any)
      expect(await feeService.getTotalFill([] as any)).toEqual({
        totalFillNormalized: emptyFill,
        ...error,
      })
      expect(getCallsNormalized).toHaveBeenCalledTimes(1)
    })

    it('should reduce and return the total rewards', async () => {
      const getCallsNormalized = jest.spyOn(feeService, 'getCallsNormalized').mockResolvedValue({
        calls: [
          { balance: 10n, native: { amount: 3n } },
          { balance: 20n, native: { amount: 2n } },
        ] as any,
        error: undefined,
      }) as any
      expect(await feeService.getTotalFill([] as any)).toEqual({
        totalFillNormalized: { native: 5n, token: 30n },
      })
      expect(getCallsNormalized).toHaveBeenCalledTimes(1)
    })
  })

  describe('on getTotalRewards', () => {
    it('should return an error upstream from getRewardsNormalized', async () => {
      const error = { error: 'error' }
      const getRewardsNormalized = jest
        .spyOn(feeService, 'getRewardsNormalized')
        .mockResolvedValue(error as any)
      expect(await feeService.getTotalRewards([] as any)).toEqual({
        totalRewardsNormalized: {
          token: 0n,
          native: 0n,
        },
        ...error,
      })
      expect(getRewardsNormalized).toHaveBeenCalledTimes(1)
    })

    it('should reduce and return the total rewards', async () => {
      const getRewardsNormalized = jest
        .spyOn(feeService, 'getRewardsNormalized')
        .mockResolvedValue({
          rewards: [{ balance: 10n }, { balance: 20n }] as any,
        })
      const quote = {
        reward: {
          nativeValue: 777n,
        },
      }
      expect(await feeService.getTotalRewards(quote as any)).toEqual({
        totalRewardsNormalized: { token: 30n, native: quote.reward.nativeValue },
      })
      expect(getRewardsNormalized).toHaveBeenCalledTimes(1)
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
    const destination = {
      chainID: 11n,
      tokens: ['0x1', '0x2', '0x3'],
    } as any

    const tokenAnalysis = [
      {
        token: {
          address: '0x1',
        },
      },
      {
        token: {
          address: '0x2',
        },
      },
      {
        token: {
          address: '0x3',
        },
      },
    ] as any
    it('should return error if source is not found', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([] as any)
      const r = await feeService.calculateTokens(quote as any)
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
      const r = await feeService.calculateTokens(quote as any)
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
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source, destination])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(undefined as any)
      await expect(feeService.calculateTokens(quote as any)).rejects.toThrow(
        QuoteError.FetchingCallTokensFailed(quote.route.source),
      )
    })

    it('should return error if getRewardsNormalized fails', async () => {
      const error = { error: 'error' }
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source, destination])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(tokenAnalysis)
      jest.spyOn(feeService, 'calculateDelta').mockReturnValue(10n as any)
      const rew = jest.spyOn(feeService, 'getRewardsNormalized').mockReturnValue({ error } as any)
      const tok = jest
        .spyOn(feeService, 'getTokensNormalized')
        .mockResolvedValue({ tokens: [] } as any)
      const call = jest
        .spyOn(feeService, 'getCallsNormalized')
        .mockReturnValue({ calls: [] } as any)
      expect(await feeService.calculateTokens(quote as any)).toEqual({ error })
      expect(rew).toHaveBeenCalledTimes(1)
      expect(tok).toHaveBeenCalledTimes(1)
      expect(call).toHaveBeenCalledTimes(1)
    })

    it('should return error if getTokensNormalized fails', async () => {
      const error = { error: 'error' }
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source, destination])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(tokenAnalysis)
      jest.spyOn(feeService, 'calculateDelta').mockReturnValue(10n as any)
      const rew = jest
        .spyOn(feeService, 'getRewardsNormalized')
        .mockReturnValue({ rewards: [] } as any)
      const tok = jest.spyOn(feeService, 'getTokensNormalized').mockResolvedValue({ error } as any)
      const call = jest
        .spyOn(feeService, 'getCallsNormalized')
        .mockReturnValue({ calls: [] } as any)
      expect(await feeService.calculateTokens(quote as any)).toEqual({ error })
      expect(rew).toHaveBeenCalledTimes(1)
      expect(tok).toHaveBeenCalledTimes(1)
      expect(call).toHaveBeenCalledTimes(1)
    })

    it('should return error if getCallsNormalized fails', async () => {
      const error = { error: 'error' }
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source, destination])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(tokenAnalysis)
      jest.spyOn(feeService, 'calculateDelta').mockReturnValue(10n as any)
      const rew = jest
        .spyOn(feeService, 'getRewardsNormalized')
        .mockReturnValue({ rewards: {} } as any)
      const tok = jest
        .spyOn(feeService, 'getTokensNormalized')
        .mockResolvedValue({ tokens: [] } as any)
      const call = jest.spyOn(feeService, 'getCallsNormalized').mockReturnValue({ error } as any)
      expect(await feeService.calculateTokens(quote as any)).toEqual({ error })
      expect(rew).toHaveBeenCalledTimes(1)
      expect(tok).toHaveBeenCalledTimes(1)
      expect(call).toHaveBeenCalledTimes(1)
    })

    it('should calculate the delta for all tokens', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source, destination])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(tokenAnalysis)
      const cal = jest.spyOn(feeService, 'calculateDelta').mockImplementation((token) => {
        return BigInt(token.token.address) as any
      })
      const rewards = { stuff: 'asdf' } as any
      const rew = jest.spyOn(feeService, 'getRewardsNormalized').mockReturnValue({ rewards } as any)
      const tokens = { stuff: '123' } as any
      const tok = jest.spyOn(feeService, 'getTokensNormalized').mockResolvedValue({ tokens } as any)
      const calls = { stuff: '123' } as any
      const call = jest.spyOn(feeService, 'getCallsNormalized').mockReturnValue({ calls } as any)
      const deficitDescending = tokenAnalysis.map((ta) => {
        return { ...ta, delta: BigInt(ta.token.address) }
      })
      expect(await feeService.calculateTokens(quote as any)).toEqual({
        calculated: {
          solver: linearSolver,
          rewards,
          tokens,
          calls,
          srcDeficitDescending: deficitDescending,
          destDeficitDescending: deficitDescending,
        },
      })
      expect(cal).toHaveBeenCalledTimes(tokenAnalysis.length * 2)
      expect(rew).toHaveBeenCalledTimes(1)
      expect(tok).toHaveBeenCalledTimes(1)
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

    it('should return error if not intent source', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([])
      expect(await feeService.getRewardsNormalized(quote as any)).toEqual({
        rewards: [],
        error: QuoteError.NoIntentSourceForSource(quote.route.source),
      })
    })

    it('should return an error if the balances call fails', async () => {
      const mockBalance = jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue({})
      expect(await feeService.getRewardsNormalized(quote as any)).toEqual({
        rewards: [],
        error: QuoteError.FetchingRewardTokensFailed(BigInt(quote.route.source)),
      })
      expect(mockBalance).toHaveBeenCalledTimes(1)
      expect(mockBalance).toHaveBeenCalledWith(
        Number(quote.route.source),
        quote.reward.tokens.map((reward) => reward.token),
      )
    })

    it('should map rewards and convertNormalize the output', async () => {
      jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue(erc20Rewards)
      const convert = jest.spyOn(feeService, 'convertNormalize')
      expect(await feeService.getRewardsNormalized(quote as any)).toEqual({
        rewards: [
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
        ],
      })
      expect(convert).toHaveBeenCalledTimes(2)
    })
  })

  describe('on getCallsNormalized', () => {
    const quote = {
      route: {
        destination: 1n,
        calls: [
          { target: '0x1' as Hex, selector: '0x2' as Hex, data: '0x3' as Hex, value: 0n },
          { target: '0x4' as Hex, selector: '0x5' as Hex, data: '0x6' as Hex, value: 0n },
        ],
      },
    }

    const solver = {
      chainID: 1n,
    } as any

    it('should return an error if a solver cant be found', async () => {
      const mockSolver = jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(undefined)
      expect(await feeService.getCallsNormalized(quote as any)).toEqual({
        calls: [],
        error: QuoteError.NoSolverForDestination(quote.route.destination),
      })
      expect(mockSolver).toHaveBeenCalledTimes(1)
    })

    it('should return an error if the balances call fails', async () => {
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solver)
      const mockBalance = jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue({})
      expect(await feeService.getCallsNormalized(quote as any)).toEqual({
        calls: [],
        error: QuoteError.FetchingCallTokensFailed(BigInt(solver.chainID)),
      })
      expect(mockBalance).toHaveBeenCalledTimes(1)
      expect(mockBalance).toHaveBeenCalledWith(solver.chainID, expect.any(Array))
    })

    describe('on route calls mapping', () => {
      let callBalances: any
      const transferAmount = 1_000_000_000n
      const txTargetData = {
        targetConfig: {
          contractType: 'erc20',
        },
        decodedFunctionData: {
          args: [0, transferAmount],
        },
      } as any
      let solverWithTargets: any = {
        chainID: 1n,
        targets: {
          '0x1': {
            type: 'erc20',
            minBalance: 200,
            targetBalance: 222,
          },
          '0x4': {
            type: 'erc20',
            minBalance: 300,
            targetBalance: 111,
          },
        },
      }
      let tokenAnalysis: any
      beforeEach(() => {
        callBalances = {
          '0x1': {
            address: '0x1',
            decimals: 6,
            balance: transferAmount,
          },
          '0x4': {
            address: '0x4',
            decimals: 4,
            balance: transferAmount,
          },
        } as any
        tokenAnalysis = {
          '0x1': {
            chainId: 1n,
            token: callBalances['0x1'],
            config: {
              address: '0x1',
              chainId: 1n,
              ...solverWithTargets.targets['0x1'],
            },
          },
          '0x4': {
            chainId: 1n,
            token: callBalances['0x4'],
            config: {
              address: '0x4',
              chainId: 1n,
              ...solverWithTargets.targets['0x4'],
            },
          },
        }
        feeService['intentConfigs'] = { skipBalanceCheck: false } as any
      })

      it('should return an error if tx target data is not for an erc20 transfer', async () => {
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solverWithTargets)
        jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue(callBalances)
        mockGetTransactionTargetData.mockReturnValue(null)
        mockIsERC20Target.mockReturnValue(false)
        expect(await feeService.getCallsNormalized(quote as any)).toEqual({
          calls: [],
          error: QuoteError.NonERC20TargetInCalls(),
        })
        expect(mockGetTransactionTargetData).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledWith({
          msg: QuoteError.NonERC20TargetInCalls().message,
          call: quote.route.calls[0],
          error: QuoteError.NonERC20TargetInCalls(),
          ttd: null,
        })
        expect(mockIsERC20Target).toHaveBeenCalledTimes(1)
        expect(mockIsERC20Target).toHaveBeenCalledWith(null, getERC20Selector('transfer'))
      })

      it('should return an error if the call target is not in the fetched balances', async () => {
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solverWithTargets)
        jest
          .spyOn(balanceService, 'fetchTokenBalances')
          .mockResolvedValue({ '0x4': callBalances['0x4'] })
        mockGetTransactionTargetData.mockReturnValue(txTargetData)
        mockIsERC20Target.mockReturnValue(true)
        expect(await feeService.getCallsNormalized(quote as any)).toEqual({
          calls: [],
          error: QuoteError.FailedToFetchTarget(
            solverWithTargets.chainID,
            quote.route.calls[0].target,
          ),
        })
      })

      it('should return an error if solver lacks liquidity in a call token', async () => {
        const normMinBalance = feeService.getNormalizedMinBalance(tokenAnalysis['0x1'])
        callBalances['0x1'].balance = transferAmount + normMinBalance - 1n
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solverWithTargets)
        jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue(callBalances)
        mockGetTransactionTargetData.mockReturnValue(txTargetData)
        mockIsERC20Target.mockReturnValue(true)
        const convert = jest.spyOn(feeService, 'convertNormalize')
        const error = QuoteError.SolverLacksLiquidity(
          solver.chainID,
          quote.route.calls[0].target,
          transferAmount,
          callBalances['0x1'].balance,
          normMinBalance,
        )
        expect(await feeService.getCallsNormalized(quote as any)).toEqual({
          calls: [],
          error,
        })
        expect(convert).toHaveBeenCalledTimes(0)
        expect(mockLogError).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledWith({
          msg: QuoteError.SolverLacksLiquidity.name,
          error,
          quote,
          callTarget: tokenAnalysis['0x1'],
        })
      })

      it('should convert and normalize the erc20 calls', async () => {
        const normMinBalance1 = feeService.getNormalizedMinBalance(tokenAnalysis['0x1'])
        const normMinBalance4 = feeService.getNormalizedMinBalance(tokenAnalysis['0x4'])
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solverWithTargets)
        callBalances['0x1'].balance = transferAmount + normMinBalance1 + 1n
        callBalances['0x4'].balance = transferAmount + normMinBalance4 + 1n
        jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue(callBalances)
        mockGetTransactionTargetData.mockReturnValue(txTargetData)
        mockIsERC20Target.mockReturnValue(true)
        const convert = jest.spyOn(feeService, 'convertNormalize')

        expect(await feeService.getCallsNormalized(quote as any)).toEqual({
          calls: [
            {
              balance: transferAmount,
              chainID: solver.chainID,
              address: '0x1',
              decimals: BASE_DECIMALS,
              recipient: 0,
              native: {
                amount: 0n,
              },
            },
            {
              balance: transferAmount * 10n ** 2n,
              chainID: solver.chainID,
              address: '0x4',
              decimals: BASE_DECIMALS,
              recipient: 0,
              native: {
                amount: 0n,
              },
            },
          ],
          error: undefined,
        })
        expect(convert).toHaveBeenCalledTimes(2)
      })

      it('should handle mixed functional and native calls correctly', async () => {
        const mixedQuote = {
          route: {
            destination: 1n,
            calls: [
              // Functional call with ERC20 transfer (value must be 0)
              { target: '0x1' as Hex, selector: '0x2' as Hex, data: '0x3' as Hex, value: 0n },
              // Pure native call with empty data
              { target: '0x7' as Hex, selector: '0x0' as Hex, data: '0x' as Hex, value: 500n },
              // Another functional call (value must be 0)
              { target: '0x4' as Hex, selector: '0x5' as Hex, data: '0x6' as Hex, value: 0n },
            ],
          },
        }

        const normMinBalance1 = feeService.getNormalizedMinBalance(tokenAnalysis['0x1'])
        const normMinBalance4 = feeService.getNormalizedMinBalance(tokenAnalysis['0x4'])
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solverWithTargets)
        callBalances['0x1'].balance = transferAmount + normMinBalance1 + 1n
        callBalances['0x4'].balance = transferAmount + normMinBalance4 + 1n
        // Only return balances for functional calls (0x1 and 0x4), not for native call (0x7)
        jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue(callBalances)
        mockGetTransactionTargetData.mockReturnValue(txTargetData)
        mockIsERC20Target.mockReturnValue(true)

        const result = await feeService.getCallsNormalized(mixedQuote as any)

        expect(result).toEqual({
          calls: [
            // First functional call
            {
              balance: transferAmount,
              chainID: solver.chainID,
              address: '0x1',
              decimals: BASE_DECIMALS,
              recipient: 0,
              native: {
                amount: 0n,
              },
            },
            // Second functional call
            {
              balance: transferAmount * 10n ** 2n,
              chainID: solver.chainID,
              address: '0x4',
              decimals: BASE_DECIMALS,
              recipient: 0,
              native: {
                amount: 0n,
              },
            },
            // Native call
            {
              recipient: '0x7',
              native: {
                amount: 500n,
              },
              balance: 0n,
              chainID: solver.chainID,
              address: '0x0000000000000000000000000000000000000000',
              decimals: 0,
            },
          ],
          error: undefined,
        })
      })

      it('should handle pure native calls only', async () => {
        const nativeOnlyQuote = {
          route: {
            destination: 1n,
            calls: [
              // Pure native calls with empty data
              { target: '0x7' as Hex, selector: '0x0' as Hex, data: '0x' as Hex, value: 300n },
              { target: '0x8' as Hex, selector: '0x0' as Hex, data: '0x' as Hex, value: 700n },
            ],
          },
        }

        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solverWithTargets)
        // fetchTokenBalances should be called with empty array since no functional calls
        // We need to provide a non-empty response to avoid the FetchingCallTokensFailed error
        jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue({
          // Add a dummy token balance so the check doesn't fail
          '0xdummy': { address: '0xdummy', balance: 1n, decimals: 18 },
        })

        const result = await feeService.getCallsNormalized(nativeOnlyQuote as any)

        expect(result).toEqual({
          calls: [
            {
              recipient: '0x7',
              native: {
                amount: 300n,
              },
              balance: 0n,
              chainID: solver.chainID,
              address: '0x0000000000000000000000000000000000000000',
              decimals: 0,
            },
            {
              recipient: '0x8',
              native: {
                amount: 700n,
              },
              balance: 0n,
              chainID: solver.chainID,
              address: '0x0000000000000000000000000000000000000000',
              decimals: 0,
            },
          ],
          error: undefined,
        })
      })

      it('should handle calls with zero native value correctly', async () => {
        const zeroValueQuote = {
          route: {
            destination: 1n,
            calls: [
              // Functional call with zero native value
              { target: '0x1' as Hex, selector: '0x2' as Hex, data: '0x3' as Hex, value: 0n },
              // Call with empty data and zero value (should not be treated as native call)
              { target: '0x9' as Hex, selector: '0x0' as Hex, data: '0x' as Hex, value: 0n },
            ],
          },
        }

        const normMinBalance1 = feeService.getNormalizedMinBalance(tokenAnalysis['0x1'])
        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solverWithTargets)
        callBalances['0x1'].balance = transferAmount + normMinBalance1 + 1n
        jest
          .spyOn(balanceService, 'fetchTokenBalances')
          .mockResolvedValue({ '0x1': callBalances['0x1'] })
        mockGetTransactionTargetData.mockReturnValue(txTargetData)
        mockIsERC20Target.mockReturnValue(true)

        const result = await feeService.getCallsNormalized(zeroValueQuote as any)

        expect(result).toEqual({
          calls: [
            // Only the functional call should be processed
            {
              balance: transferAmount,
              chainID: solver.chainID,
              address: '0x1',
              decimals: BASE_DECIMALS,
              recipient: 0,
              native: {
                amount: 0n,
              },
            },
          ],
          error: undefined,
        })
      })

      it('should call fetchTokenBalances with only functional call targets', async () => {
        const mixedQuote = {
          route: {
            destination: 1n,
            calls: [
              { target: '0x1' as Hex, selector: '0x2' as Hex, data: '0x3' as Hex, value: 0n },
              { target: '0x7' as Hex, selector: '0x0' as Hex, data: '0x' as Hex, value: 500n },
              { target: '0x4' as Hex, selector: '0x5' as Hex, data: '0x6' as Hex, value: 0n },
            ],
          },
        }

        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solverWithTargets)
        const fetchTokenBalancesSpy = jest
          .spyOn(balanceService, 'fetchTokenBalances')
          .mockResolvedValue(callBalances)
        mockGetTransactionTargetData.mockReturnValue(txTargetData)
        mockIsERC20Target.mockReturnValue(true)

        await feeService.getCallsNormalized(mixedQuote as any)

        // Should only be called with functional call targets (0x1 and 0x4), not native call target (0x7)
        expect(fetchTokenBalancesSpy).toHaveBeenCalledWith(solver.chainID, ['0x1', '0x4'])
      })

      it('should handle empty calls array', async () => {
        const emptyQuote = {
          route: {
            destination: 1n,
            calls: [],
          },
          reward: {
            nativeValue: 0n,
          },
        }

        jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solverWithTargets)
        jest.spyOn(balanceService, 'fetchTokenBalances').mockResolvedValue({})

        const result = await feeService.getCallsNormalized(emptyQuote as any)

        expect(result).toEqual({
          calls: [],
          error: QuoteError.FetchingCallTokensFailed(BigInt(solver.chainID)),
        })
      })
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
        token: {
          address: '0x1',
          decimals: BASE_DECIMALS,
          balance: 300_000_000n,
        },
        chainId: 10,
      }
    })
    it('should calculate the delta for surplus', async () => {
      const convertNormalizeSpy = jest.spyOn(feeService, 'convertNormalize')
      const normToken = feeService.calculateDelta(token)
      const expectedNorm: NormalizedToken = {
        balance: 100_000_000n,
        chainID: BigInt(token.chainId),
        address: token.config.address,
        decimals: token.token.decimals,
      }
      expect(normToken).toEqual(expectedNorm)

      expect(convertNormalizeSpy).toHaveBeenCalledTimes(1)
      expect(convertNormalizeSpy).toHaveBeenCalledWith(100_000_000n, expect.any(Object))
    })

    it('should calculate the delta for deficit', async () => {
      const convertNormalizeSpy = jest.spyOn(feeService, 'convertNormalize')
      token.token.balance = 100_000_000n
      const normToken = feeService.calculateDelta(token)
      const expectedNorm: NormalizedToken = {
        balance: -100_000_000n,
        chainID: BigInt(token.chainId),
        address: token.config.address,
        decimals: token.token.decimals,
      }
      expect(normToken).toEqual(expectedNorm)

      expect(convertNormalizeSpy).toHaveBeenCalledTimes(1)
      expect(convertNormalizeSpy).toHaveBeenCalledWith(-100_000_000n, expect.any(Object))
    })

    it('should call correct normalization', async () => {
      token.token.decimals = 4
      token.token.balance = token.token.balance / 10n ** 2n
      const convertNormalizeSpy = jest.spyOn(feeService, 'convertNormalize')
      const normToken = feeService.calculateDelta(token)
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
      expect(feeService.convertNormalize(100n, orig)).toEqual({ balance: 100n, ...orig })
      const second = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      expect(feeService.convertNormalize(100n, second)).toEqual({
        balance: 10000n,
        ...second,
        decimals: 6,
      })
    })

    it('should change the decimals to the normalized value', async () => {
      const second = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      expect(feeService.convertNormalize(100n, second)).toEqual({
        balance: 10000n,
        ...second,
        decimals: 6,
      })
    })
  })

  describe('on deconvertNormalize', () => {
    it('should denormalize the output', async () => {
      const orig = { chainID: 1n, address: '0x' as Hex, decimals: 6 }
      expect(feeService.deconvertNormalize(100n, orig)).toEqual({ balance: 100n, ...orig })
      const second = { chainID: 1n, address: '0x' as Hex, decimals: 4 }
      expect(feeService.deconvertNormalize(100n, second)).toEqual({ balance: 1n, ...second })
    })
  })

  describe('on getAskRouteDestinationSolver', () => {
    let solverSpy: jest.SpyInstance
    beforeEach(() => {
      solverSpy = jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
    })

    it('should return the destination route solver', async () => {
      let route = {
        destination: 10n,
        source: 20n,
      } as any
      feeService.getAskRouteDestinationSolver(route)
      expect(solverSpy).toHaveBeenCalledWith(route.destination)
    })

    it('should return the eth solver if its one of the networks in the route', async () => {
      let route = {
        destination: 1n,
        source: 2n,
      } as any
      feeService.getAskRouteDestinationSolver(route)
      expect(solverSpy).toHaveBeenCalledWith(1n)

      route = {
        destination: 2n,
        source: 1n,
      } as any
      feeService.getAskRouteDestinationSolver(route)
      expect(solverSpy).toHaveBeenCalledWith(1n)

      route = {
        destination: 11155111n,
        source: 2n,
      } as any
      feeService.getAskRouteDestinationSolver(route)
      expect(solverSpy).toHaveBeenCalledWith(11155111n)

      route = {
        destination: 2n,
        source: 11155111n,
      } as any
      feeService.getAskRouteDestinationSolver(route)
      expect(solverSpy).toHaveBeenCalledWith(11155111n)
    })
  })
})
