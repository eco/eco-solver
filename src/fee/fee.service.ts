import { BalanceService, TokenFetchAnalysis } from '@/balance/balance.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getERC20Selector, isERC20Target } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Solver } from '@/eco-configs/eco-config.types'
import { CalculateTokensType, NormalizedToken } from '@/fee/types'
import { normalizeBalance } from '@/fee/utils'
import { getTransactionTargetData } from '@/intent/utils'
import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { QuoteError } from '@/quote/errors'
import { Mathb } from '@/utils/bigint'
import { Injectable, Logger } from '@nestjs/common'
import { getAddress, Hex } from 'viem'

/**
 * The base decimal number for erc20 tokens.
 */
export const BASE_DECIMALS: number = 6

@Injectable()
export class FeeService {
  private logger = new Logger(FeeService.name)

  constructor(
    private readonly balanceService: BalanceService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  /**
   * Gets the ask for the quote
   *
   * @param totalFulfill the total amount to fulfill, assumes base6
   * @param route the route of the quote intent
   * @returns a bigint representing the ask
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAsk(totalFulfill: bigint, route: QuoteRouteDataInterface) {
    //hardcode the destination to eth mainnet/sepolia if its part of the route
    const destination =
      route.destination === 1n || route.source === 1n
        ? 1n
        : route.destination === 11155111n || route.source === 11155111n
          ? 11155111n
          : route.destination

    const solver = this.ecoConfigService.getSolver(destination)
    if (!solver) {
      //we shouldn't get here after validations are run so throw
      throw QuoteError.NoSolverForDestination(destination)
    }
    let fee = 0n
    switch (solver.fee.feeAlgorithm) {
      // 0.02 cents + $0.015 per 100$
      // 20_000n + (totalFulfill / 100_000_000n) * 15_000n
      case 'linear':
        const s = solver as Solver<'linear'>
        fee =
          s.fee.constants.baseFee + (totalFulfill / 100_000_000n) * s.fee.constants.per100UnitFee
        break
      default:
        throw QuoteError.InvalidSolverAlgorithm(route.destination, solver.fee.feeAlgorithm)
    }
    return fee + totalFulfill
  }

  /**
   * Checks if the route is feasible for the quote intent:
   * 1) the solver can fulfill the transaction
   * 2) the route is profitable for the solver, ie the rewards cover the ask
   * @param quote the quote
   * @returns the error is undefined, error is defined if its not feasible
   */
  async isRouteFeasible(quote: QuoteIntentDataInterface): Promise<{ error?: Error }> {
    if (quote.route.calls.length != 1) {
      //todo support multiple calls after testing
      return { error: QuoteError.MultiFulfillRoute() }
    }
    const { totalFillNormalized, error } = await this.getTotalFill(quote)
    if (!!error) {
      return { error }
    }
    const { totalRewardsNormalized, error: error1 } = await this.getTotalRewards(quote)
    if (!!error1) {
      return { error: error1 }
    }
    const ask = this.getAsk(totalFillNormalized, quote.route)
    return {
      error:
        totalRewardsNormalized >= ask
          ? undefined
          : QuoteError.RouteIsInfeasable(ask, totalRewardsNormalized),
    }
  }

  /**
   * Calculates the total normalized fill for the quote intent
   *
   * @param quote the quote intent
   * @returns
   */
  async getTotalFill(
    quote: QuoteIntentDataInterface,
  ): Promise<{ totalFillNormalized: bigint; error?: Error }> {
    const { calls, error } = await this.getCallsNormalized(quote)
    if (error) {
      return { totalFillNormalized: 0n, error }
    }
    return { totalFillNormalized: calls.reduce((acc, call) => acc + call.balance, 0n) }
  }

  /**
   * Calculates the total normalized and acceoted rewards for the quote intent
   * @param quote the quote intent
   * @returns
   */
  async getTotalRewards(
    quote: QuoteIntentDataInterface,
  ): Promise<{ totalRewardsNormalized: bigint; error?: Error }> {
    const { rewards, error } = await this.getRewardsNormalized(quote)
    if (error) {
      return { totalRewardsNormalized: 0n, error }
    }
    return { totalRewardsNormalized: rewards.reduce((acc, reward) => acc + reward.balance, 0n) }
  }

  /**
   * Gets the solver tokens for the source chain and orders them in
   * a normalized delta descending order. delta = (balance - minBalance) * decimals
   * @param route the route
   * @returns
   */
  async calculateTokens(quote: QuoteIntentDataInterface): Promise<{
    calculated?: CalculateTokensType
    error?: Error
  }> {
    const route = quote.route
    const srcChainID = route.source
    const destChainID = route.destination

    const source = this.ecoConfigService
      .getIntentSources()
      .find((intent) => BigInt(intent.chainID) == srcChainID)!
    const solver = this.ecoConfigService.getSolver(destChainID)!

    if (!source || !solver) {
      let error: Error | undefined
      if (!source) {
        error = QuoteError.NoIntentSourceForSource(srcChainID)
      } else if (!solver) {
        error = QuoteError.NoSolverForDestination(destChainID)
      }
      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: error.message,
            properties: {
              error,
              source,
              solver,
            },
          }),
        )
        return { error }
      }
    }

    //Get the tokens the solver accepts on the source chain
    const balance = await this.balanceService.fetchTokenData(Number(srcChainID))
    if (!balance) {
      throw QuoteError.FetchingCallTokensFailed(quote.route.source)
    }
    const deficitDescending = balance
      .filter((token) => source.tokens.includes(token.balance.address))
      .map((token) => {
        return {
          ...token,
          //calculates, converts and normalizes the delta
          delta: this.calculateDelta(token),
        }
      })
      //Sort tokens with leading deficits than: inrange/surplus reordered in accending order
      .sort((a, b) => -1 * Mathb.compare(a.delta.balance, b.delta.balance))

    //ge/calculate the rewards for the quote intent
    const { rewards, error: errorRewards } = await this.getRewardsNormalized(quote)
    const { calls, error: errorCalls } = await this.getCallsNormalized(quote)
    if (errorCalls || errorRewards) {
      return { error: errorCalls || errorRewards }
    }
    return {
      calculated: {
        solver,
        rewards,
        calls,
        deficitDescending, //token liquidity with deficit first descending
      },
    }
  }

  /**
   * Fetches the rewardes for the quote intent, grabs their info from the erc20 contracts and then converts
   * and normalizes their values
   * @param quote the quote intent
   */
  async getRewardsNormalized(
    quote: QuoteIntentDataInterface,
  ): Promise<{ rewards: NormalizedToken[]; error?: Error }> {
    const srcChainID = quote.route.source
    const source = this.ecoConfigService
      .getIntentSources()
      .find((intent) => BigInt(intent.chainID) == srcChainID)
    if (!source) {
      return { rewards: [], error: QuoteError.NoIntentSourceForSource(srcChainID) }
    }
    const acceptedTokens = quote.reward.tokens
      .filter((reward) => source.tokens.includes(reward.token))
      .map((reward) => reward.token)
    const erc20Rewards = await this.balanceService.fetchTokenBalances(
      Number(srcChainID),
      acceptedTokens,
    )
    if (Object.keys(erc20Rewards).length === 0) {
      return { rewards: [], error: QuoteError.FetchingRewardTokensFailed(BigInt(srcChainID)) }
    }

    return {
      rewards: Object.values(erc20Rewards).map((tb) => {
        const token = quote.reward.tokens.find((reward) => getAddress(reward.token) === tb.address)
        return this.convertNormalize(token!.amount, {
          chainID: srcChainID,
          address: tb.address,
          decimals: tb.decimals,
        })
      }),
    }
  }

  /**
   * Fetches the call tokens for the quote intent, grabs their info from the erc20 contracts and then converts
   * to a standard reserve value for comparisons
   *
   * Throws if there is not enought liquidity for the call
   *
   * @param quote the quote intent
   * @param solver the solver for the quote intent
   * @returns
   */
  async getCallsNormalized(quote: QuoteIntentDataInterface): Promise<{
    calls: NormalizedToken[]
    error: Error | undefined
  }> {
    const solver = this.ecoConfigService.getSolver(quote.route.destination)
    if (!solver) {
      return { calls: [], error: QuoteError.NoSolverForDestination(quote.route.destination) }
    }
    const callERC20Balances = await this.balanceService.fetchTokenBalances(
      solver.chainID,
      quote.route.calls.map((call) => call.target),
    )
    if (Object.keys(callERC20Balances).length === 0) {
      return { calls: [], error: QuoteError.FetchingCallTokensFailed(BigInt(solver.chainID)) }
    }
    let error: Error | undefined

    let calls: NormalizedToken[] = []
    try {
      calls = quote.route.calls.map((call) => {
        const ttd = getTransactionTargetData(solver, call)
        if (!isERC20Target(ttd, getERC20Selector('transfer'))) {
          const err = QuoteError.NonERC20TargetInCalls()
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: err.message,
              properties: {
                error: err,
                call,
                ttd,
              },
            }),
          )
          throw err
        }
        const callTarget = callERC20Balances[call.target]
        if (!callTarget) {
          throw QuoteError.FailedToFetchTarget(BigInt(solver.chainID), call.target)
        }

        const transferAmount = ttd!.decodedFunctionData.args![1] as bigint
        if (transferAmount > callTarget.balance) {
          throw QuoteError.SolverLacksLiquidity(
            solver.chainID,
            call.target,
            transferAmount,
            callTarget.balance,
          )
        }
        return this.convertNormalize(transferAmount, {
          chainID: BigInt(solver.chainID),
          address: call.target,
          decimals: callTarget.decimals,
        })
      })
    } catch (e) {
      error = e
    }

    return { calls, error }
  }

  /**
   * Calculates the delta for the token as defined as the balance - minBalance
   * @param token the token to us
   * @returns
   */
  calculateDelta(token: TokenFetchAnalysis) {
    const minBalance = normalizeBalance(
      { balance: BigInt(token.config.minBalance), decimal: 0 },
      token.balance.decimals,
    ).balance
    const delta = token.balance.balance - minBalance
    return this.convertNormalize(delta, {
      chainID: BigInt(token.chainId),
      address: token.config.address,
      decimals: token.balance.decimals,
    })
  }

  /**
   * Converts and normalizes the token to a standard reserve value for comparisons
   * @param value the value to convert
   * @param token the token to us
   * @returns
   */
  convertNormalize(
    value: bigint,
    token: { chainID: bigint; address: Hex; decimals: number },
  ): NormalizedToken {
    const original = value
    const newDecimals = BASE_DECIMALS
    //todo some conversion, assuming here 1-1
    return {
      ...token,
      balance: normalizeBalance({ balance: original, decimal: token.decimals }, newDecimals)
        .balance,
      decimals: newDecimals,
    }
  }

  /**
   * Deconverts and denormalizes the token form a standard reserve value for comparisons
   * @param value the value to deconvert
   * @param token the token to deconvert
   * @returns
   */
  deconvertNormalize(value: bigint, token: { chainID: bigint; address: Hex; decimals: number }) {
    const original = value
    //todo some conversion, assuming here 1-1
    return {
      ...token,
      balance: normalizeBalance({ balance: original, decimal: BASE_DECIMALS }, token.decimals)
        .balance,
    }
  }
}
