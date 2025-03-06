const mockGetTransactionTargetData = jest.fn()
const mockIsERC20Target = jest.fn()
import { BalanceService, TokenFetchAnalysis } from '@/balance/balance.service'
import { getERC20Selector } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BASE_DECIMALS, FeeService } from '@/fee/fee.service'
import { NormalizedToken } from '@/fee/types'
import { QuoteError } from '@/quote/errors'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { Hex } from 'viem'

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
  const route = {
    destination: 8452n,
    source: 10n,
  } as any

  const linearSolver = {
    fee: {
      feeAlgorithm: 'linear',
      constants: {
        baseFee: 20_000n,
        per100UnitFee: 15_000n,
      },
    },
  } as any
  describe('on getAsk', () => {
    describe('on invalid solver', () => {
      it('should throw if no solver found', async () => {
        const getSolver = jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(undefined)
        expect(() => feeService.getAsk(1_000_000n, route)).toThrow(
          QuoteError.NoSolverForDestination(route.destination),
        )
        expect(getSolver).toHaveBeenCalledTimes(1)
      })

      it('should throw solver doesnt have a supported algorithm', async () => {
        const solver = { fee: { feeAlgorithm: 'unsupported' } } as any
        const getSolver = jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(solver)
        expect(() => feeService.getAsk(1_000_000n, route)).toThrow(
          QuoteError.InvalidSolverAlgorithm(route.destination, solver.fee.feeAlgorithm),
        )
        expect(getSolver).toHaveBeenCalledTimes(1)
      })
    })

    describe('on linear fee algorithm', () => {
      let spy: jest.SpyInstance
      beforeEach(() => {
        spy = jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      })

      it('should default to eth mainnet/sepolia fee if eth mainnet/sepolia is in the route', async () => {
        let ethRoute = {
          destination: 8452n,
          source: 1n,
        } as any

        expect(feeService.getAsk(1_000_000n, ethRoute)).toBe(1_020_000n)
        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith(ethRoute.source)

        ethRoute = {
          destination: 1n,
          source: 10n,
        } as any
        expect(feeService.getAsk(1_000_000n, ethRoute)).toBe(1_020_000n)
        expect(spy).toHaveBeenCalledTimes(2)
        expect(spy).toHaveBeenCalledWith(ethRoute.destination)

        ethRoute = {
          destination: 84523n,
          source: 11155111n,
        } as any
        expect(feeService.getAsk(1_000_000n, ethRoute)).toBe(1_020_000n)
        expect(spy).toHaveBeenCalledTimes(3)
        expect(spy).toHaveBeenCalledWith(ethRoute.source)

        ethRoute = {
          destination: 11155111n,
          source: 84523n,
        } as any
        expect(feeService.getAsk(1_000_000n, ethRoute)).toBe(1_020_000n)
        expect(spy).toHaveBeenCalledTimes(4)
        expect(spy).toHaveBeenCalledWith(ethRoute.destination)
      })

      it('should return the correct ask for less than $100', async () => {
        const ask = feeService.getAsk(1_000_000n, route)
        expect(ask).toBe(1_020_000n)
      })

      it('should return the correct ask for multiples of $100', async () => {
        expect(feeService.getAsk(99_000_000n, route)).toBe(99_020_000n)
        expect(feeService.getAsk(100_000_000n, route)).toBe(100_035_000n)
        expect(feeService.getAsk(999_000_000n, route)).toBe(999_155_000n)
        expect(feeService.getAsk(1_000_000_000n, route)).toBe(1000_170_000n)
      })
    })
  })

  describe('on isRouteFeasible', () => {
    let quote: any
    const ask = 11n
    const totalRewardsNormalized = 10n
    const totalFillNormalized = 10n
    const error = { error: 'error' } as any
    beforeEach(() => {
      quote = {
        route: {
          calls: [{}],
        },
      }
    })
    it('should return an error if route has more than 1 call', async () => {
      quote.route.calls.push({})
      expect(await feeService.isRouteFeasible(quote)).toEqual({
        error: QuoteError.MultiFulfillRoute(),
      })
    })

    it('should return an error if getTotalFill fails', async () => {
      const getTotallFill = jest.spyOn(feeService, 'getTotalFill').mockResolvedValue(error)
      expect(await feeService.isRouteFeasible(quote)).toEqual(error)
      expect(getTotallFill).toHaveBeenCalledTimes(1)
    })

    it('should return an error if getTotalRewards fails', async () => {
      jest
        .spyOn(feeService, 'getTotalFill')
        .mockResolvedValue({ totalFillNormalized: 10n, error: undefined })
      const getTotalRewards = jest.spyOn(feeService, 'getTotalRewards').mockResolvedValue(error)
      expect(await feeService.isRouteFeasible(quote)).toEqual(error)
      expect(getTotalRewards).toHaveBeenCalledTimes(1)
    })

    it('should return an error if the ask is less than the total reward', async () => {
      jest
        .spyOn(feeService, 'getTotalFill')
        .mockResolvedValue({ totalFillNormalized, error: undefined })
      jest
        .spyOn(feeService, 'getTotalRewards')
        .mockResolvedValue({ totalRewardsNormalized, error: undefined })
      const getAsk = jest.spyOn(feeService, 'getAsk').mockReturnValue(11n)
      expect(await feeService.isRouteFeasible(quote)).toEqual({
        error: QuoteError.RouteIsInfeasable(ask, totalRewardsNormalized),
      })
      expect(getAsk).toHaveBeenCalledTimes(1)
    })

    it('should return an undefined error if the route is feasible', async () => {
      jest
        .spyOn(feeService, 'getTotalFill')
        .mockResolvedValue({ totalFillNormalized, error: undefined })
      jest.spyOn(feeService, 'getTotalRewards').mockResolvedValue({
        totalRewardsNormalized: totalRewardsNormalized + 2n,
        error: undefined,
      })
      jest.spyOn(feeService, 'getAsk').mockReturnValue(ask)
      expect(await feeService.isRouteFeasible(quote)).toEqual({ error: undefined })
    })
  })

  describe('on getTotalFill', () => {
    it('should return an error upstream from getCallsNormalized', async () => {
      const error = { error: 'error' }
      const getCallsNormalized = jest
        .spyOn(feeService, 'getCallsNormalized')
        .mockResolvedValue(error as any)
      expect(await feeService.getTotalFill([] as any)).toEqual({
        totalFillNormalized: 0n,
        ...error,
      })
      expect(getCallsNormalized).toHaveBeenCalledTimes(1)
    })

    it('should reduce and return the total rewards', async () => {
      const getCallsNormalized = jest.spyOn(feeService, 'getCallsNormalized').mockResolvedValue({
        calls: [{ balance: 10n }, { balance: 20n }] as any,
        error: undefined,
      }) as any
      expect(await feeService.getTotalFill([] as any)).toEqual({ totalFillNormalized: 30n })
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
        totalRewardsNormalized: 0n,
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
      expect(await feeService.getTotalRewards([] as any)).toEqual({ totalRewardsNormalized: 30n })
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
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(undefined as any)
      await expect(feeService.calculateTokens(quote as any)).rejects.toThrow(
        QuoteError.FetchingCallTokensFailed(quote.route.source),
      )
    })

    it('should return error if getRewardsNormalized fails', async () => {
      const error = { error: 'error' }
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(tokenAnalysis)
      jest.spyOn(feeService, 'calculateDelta').mockReturnValue(10n as any)
      const rew = jest.spyOn(feeService, 'getRewardsNormalized').mockReturnValue({ error } as any)
      const call = jest
        .spyOn(feeService, 'getCallsNormalized')
        .mockReturnValue({ calls: {} } as any)
      expect(await feeService.calculateTokens(quote as any)).toEqual({ error })
      expect(rew).toHaveBeenCalledTimes(1)
      expect(call).toHaveBeenCalledTimes(1)
    })

    it('should return error if getCallsNormalized fails', async () => {
      const error = { error: 'error' }
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(tokenAnalysis)
      jest.spyOn(feeService, 'calculateDelta').mockReturnValue(10n as any)
      const rew = jest
        .spyOn(feeService, 'getRewardsNormalized')
        .mockReturnValue({ rewards: {} } as any)
      const call = jest.spyOn(feeService, 'getCallsNormalized').mockReturnValue({ error } as any)
      expect(await feeService.calculateTokens(quote as any)).toEqual({ error })
      expect(rew).toHaveBeenCalledTimes(1)
      expect(call).toHaveBeenCalledTimes(1)
    })

    it('should calculate the delta for all tokens', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([source])
      jest.spyOn(ecoConfigService, 'getSolver').mockReturnValue(linearSolver)
      jest.spyOn(balanceService, 'fetchTokenData').mockResolvedValue(tokenAnalysis)
      const cal = jest.spyOn(feeService, 'calculateDelta').mockImplementation((token) => {
        return BigInt(token.token.address) as any
      })
      const rewards = { stuff: 'asdf' } as any
      const rew = jest.spyOn(feeService, 'getRewardsNormalized').mockReturnValue({ rewards } as any)
      const calls = { stuff: '123' } as any
      const call = jest.spyOn(feeService, 'getCallsNormalized').mockReturnValue({ calls } as any)
      const deficitDescending = tokenAnalysis.map((ta) => {
        return { ...ta, delta: BigInt(ta.token.address) }
      })
      expect(await feeService.calculateTokens(quote as any)).toEqual({
        calculated: {
          solver: linearSolver,
          rewards,
          calls,
          deficitDescending,
        },
      })
      expect(cal).toHaveBeenCalledTimes(tokenAnalysis.length)
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
          { target: '0x1' as Hex, selector: '0x2' as Hex, data: '0x3' as Hex },
          { target: '0x4' as Hex, selector: '0x5' as Hex, data: '0x6' as Hex },
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
      const transferAmount = 1000_000_000n
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
        }
      }
      let tokenAnalysis : any
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
              ...solverWithTargets.targets['0x1']
            }
          },
          '0x4': {
            chainId: 1n,
            token: callBalances['0x4'],
            config: {
              address: '0x4',
              chainId: 1n,
              ...solverWithTargets.targets['0x4']
            }
          }
        }
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
          error: QuoteError.FailedToFetchTarget(solverWithTargets.chainID, quote.route.calls[0].target),
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
          normMinBalance
        )
        expect(await feeService.getCallsNormalized(quote as any)).toEqual({
          calls: [],
          error
        })
        expect(convert).toHaveBeenCalledTimes(0)
        expect(mockLogError).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledWith({
          msg: QuoteError.SolverLacksLiquidity.name,
          error,
          quote,
          callTarget: tokenAnalysis['0x1']
        })
      })

      it('should convert an normalize the erc20 calls', async () => {
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
            },
            {
              balance: transferAmount * 10n ** 2n,
              chainID: solver.chainID,
              address: '0x4',
              decimals: BASE_DECIMALS,
            },
          ],
        })
        expect(convert).toHaveBeenCalledTimes(2)
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
})
