import { BalanceService, TokenFetchAnalysis } from '@/balance/balance.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getERC20Selector, isERC20Target } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import {
  FeeAlgorithmConfig,
  FeeConfigType,
  IntentConfig,
  WhitelistFeeRecord,
} from '@/eco-configs/eco-config.types'
import { CalculateTokensType, NormalizedToken } from '@/fee/types'
import { normalizeBalance } from '@/fee/utils'
import { getTransactionTargetData } from '@/intent/utils'
import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { QuoteError } from '@/quote/errors'
import { Mathb } from '@/utils/bigint'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { getAddress, Hex } from 'viem'
import * as _ from 'lodash'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'

/**
 * The base decimal number for erc20 tokens.
 */
export const BASE_DECIMALS: number = 6

@Injectable()
export class FeeService implements OnModuleInit {
  private logger = new Logger(FeeService.name)
  private intentConfigs: IntentConfig
  private whitelist: WhitelistFeeRecord

  constructor(
    private readonly balanceService: BalanceService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  onModuleInit() {
    this.intentConfigs = this.ecoConfigService.getIntentConfigs()
    this.whitelist = this.ecoConfigService.getWhitelist()
  }

  /**
   * Returns the fee for a transaction, if the intent is provided
   * then it returns a special fee for that intent if there is one,
   * otherwise it returns the default fee
   *
   * @param intent the optional intent for the fee
   * @param defaultFeeArg the default fee to use if the intent is not provided,
   *                      usually from the solvers own config
   * @returns
   */
  getFeeConfig(args?: {
    intent?: QuoteIntentDataInterface
    defaultFeeArg?: FeeConfigType
  }): FeeConfigType {
    const { intent, defaultFeeArg } = args || {}
    let feeConfig = defaultFeeArg || this.intentConfigs.defaultFee
    if (intent) {
      const destDefaultFee = this.getAskRouteDestinationSolver(intent.route).fee
      feeConfig = defaultFeeArg || destDefaultFee
      const specialFee = this.whitelist[intent.reward.creator]
      if (specialFee) {
        const chainFee = specialFee[Number(intent.route.source)]
        // return a fee that is a merge of the default fee, the special fee and the chain fee
        // merges left to right with the rightmost object taking precedence. In this
        // case that is the user and chain specific fee
        feeConfig = _.merge({}, feeConfig, specialFee.default, chainFee)
      }
    }
    return feeConfig
  }

  /**
   * Gets the ask for the quote
   *
   * @param totalFulfill the total amount to fulfill, assumes base6
   * @param route the route of the quote intent
   * @returns a bigint representing the ask
   */
  getAsk(totalFulfill: bigint, intent: QuoteIntentDataInterface) {
    const route = intent.route
    //hardcode the destination to eth mainnet/sepolia if its part of the route
    const solver = this.getAskRouteDestinationSolver(route)

    let fee = 0n
    const feeConfig = this.getFeeConfig({ intent, defaultFeeArg: solver.fee })
    switch (feeConfig.algorithm) {
      // the default
      // 0.02 cents + $0.015 per 100$
      // 20_000n + (totalFulfill * 15_000n) / 100_000_000n
      case 'linear':
        const { tranche } = feeConfig.constants as FeeAlgorithmConfig<'linear'>
        fee =
          BigInt(feeConfig.constants.baseFee) +
          (totalFulfill * BigInt(tranche.unitFee)) / BigInt(tranche.unitSize)
        break
      default:
        throw QuoteError.InvalidSolverAlgorithm(route.destination, solver.fee.algorithm)
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
    const ask = this.getAsk(totalFillNormalized, quote)
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
      .filter((tokenAnalysis) => source.tokens.includes(tokenAnalysis.token.address))
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
    const erc20Balances = Object.values(callERC20Balances).reduce(
      (acc, tokenBalance) => {
        const config = solver.targets[tokenBalance.address]
        acc[tokenBalance.address] = {
          token: tokenBalance,
          config: {
            ...config,
            chainId: solver.chainID,
            address: tokenBalance.address,
            type: 'erc20',
          },
          chainId: solver.chainID,
        }
        return acc
      },
      {} as Record<Hex, TokenFetchAnalysis>,
    )

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
        const callTarget = erc20Balances[call.target]
        if (!callTarget) {
          throw QuoteError.FailedToFetchTarget(BigInt(solver.chainID), call.target)
        }

        const transferAmount = ttd!.decodedFunctionData.args![1] as bigint
        const normMinBalance = this.getNormalizedMinBalance(callTarget)
        if (
          !this.intentConfigs.skipBalanceCheck &&
          transferAmount > callTarget.token.balance - normMinBalance
        ) {
          const err = QuoteError.SolverLacksLiquidity(
            solver.chainID,
            call.target,
            transferAmount,
            callTarget.token.balance,
            normMinBalance,
          )
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: QuoteError.SolverLacksLiquidity.name,
              properties: {
                error: err,
                quote,
                callTarget,
              },
            }),
          )
          throw err
        }
        return this.convertNormalize(transferAmount, {
          chainID: BigInt(solver.chainID),
          address: call.target,
          decimals: callTarget.token.decimals,
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
    const minBalance = this.getNormalizedMinBalance(token)
    const delta = token.token.balance - minBalance
    return this.convertNormalize(delta, {
      chainID: BigInt(token.chainId),
      address: token.config.address,
      decimals: token.token.decimals,
    })
  }

  /**
   * Returns the normalized min balance for the token. Assumes that the minBalance is
   * set with a decimal of 0, ie in normal dollar units
   * @param tokenAnalysis the token to use
   * @returns
   */
  getNormalizedMinBalance(tokenAnalysis: TokenFetchAnalysis) {
    return normalizeBalance(
      { balance: BigInt(tokenAnalysis.config.minBalance), decimal: 0 },
      tokenAnalysis.token.decimals,
    ).balance
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

  /**
   * Returbs the default route destination solver, unless its a ethereum L1 (mainnet or sepolia).
   * In which case it returns that one instead
   *
   * @param route The route of the quote intent
   * @returns
   */
  getAskRouteDestinationSolver(route: QuoteRouteDataInterface) {
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
    return solver
  }
}
