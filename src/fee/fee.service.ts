import { BalanceService, TokenFetchAnalysis } from '@/balance/balance.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { CallDataInterface, getERC20Selector, isERC20Target } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import {
  FeeAlgorithmConfig,
  FeeConfigType,
  IntentConfig,
  WhitelistFeeRecord,
} from '@/eco-configs/eco-config.types'
import { CalculateTokensType, NormalizedCall, NormalizedToken, NormalizedTotal } from '@/fee/types'
import { getTransferFromTokens, isInsufficient, normalizeBalance, normalizeSum } from '@/fee/utils'
import {
  getFunctionCalls,
  getIntentTokens,
  getNativeCalls,
  getTransactionTargetData,
  isNativeIntent,
} from '@/intent/utils'
import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { QuoteError } from '@/quote/errors'
import { Mathb } from '@/utils/bigint'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { getAddress, Hex, zeroAddress } from 'viem'
import * as _ from 'lodash'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { hasDuplicateStrings } from '@/common/utils/strings'
import { EcoAnalyticsService } from '@/analytics'

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
    private readonly ecoAnalytics: EcoAnalyticsService,
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
   * @param args
   * @param args.intent the optional intent for the fee
   * @param args.defaultFeeArg the default fee to use if the intent is not provided,
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
      feeConfig = defaultFeeArg || this.getRouteDestinationSolverFee(intent.route)
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
   * Calculates the fee for the transaction based on an amount and the intent
   *
   * @param normalizedTotal the amount to use for the fee
   * @param intent the quote intent
   * @returns a bigint representing the fee
   */
  getFee(normalizedTotal: NormalizedTotal, intent: QuoteIntentDataInterface): NormalizedTotal {
    const route = intent.route
    //hardcode the destination to eth mainnet/sepolia if its part of the route
    const solverFee = this.getRouteDestinationSolverFee(route)

    const fee: NormalizedTotal = {
      token: 0n,
      native: 0n,
    }

    const feeConfig = this.getFeeConfig({ intent, defaultFeeArg: solverFee })

    switch (feeConfig.algorithm) {
      // the default
      // 0.02 cents + $0.015 per 100$
      // 20_000n + (totalFulfill * 15_000n) / 100_000_000n
      case 'linear':
        const tokenConfig = (feeConfig.constants as FeeAlgorithmConfig<'linear'>).token
        const nativeConfig = (feeConfig.constants as FeeAlgorithmConfig<'linear'>).native
        if (normalizedTotal.token !== 0n) {
          const unitSize = BigInt(tokenConfig.tranche.unitSize)
          const units =
            normalizedTotal.token / unitSize + (normalizedTotal.token % unitSize > 0n ? 1n : 0n)
          fee.token = BigInt(tokenConfig.baseFee) + units * BigInt(tokenConfig.tranche.unitFee)
        }

        //TODO add some fulfillment transaction simulation costs to the fee
        if (normalizedTotal.native !== 0n) {
          const unitSize = BigInt(nativeConfig.tranche.unitSize)
          const units =
            normalizedTotal.native / unitSize + (normalizedTotal.native % unitSize > 0n ? 1n : 0n)
          fee.native = BigInt(nativeConfig.baseFee) + units * BigInt(nativeConfig.tranche.unitFee)
        }

        break
      default:
        throw QuoteError.InvalidSolverAlgorithm(route.destination, solverFee.algorithm)
    }
    return fee
  }

  /**
   * Gets the ask for the quote
   *
   * @param totalFulfill the total amount to fulfill, assumes base6
   * @param intent the quote intent
   * @returns a bigint representing the ask
   */
  getAsk(totalFulfill: NormalizedTotal, intent: QuoteIntentDataInterface) {
    const fee = this.getFee(totalFulfill, intent)
    return normalizeSum(fee, totalFulfill)
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

    const rewardTokens = _.map(quote.reward.tokens, 'token')
    if (hasDuplicateStrings(rewardTokens)) {
      return { error: QuoteError.DuplicatedRewardToken() }
    }

    const { totalFillNormalized, error: totalFillError } = await this.getTotalFill(quote)

    if (Boolean(totalFillError)) {
      return { error: totalFillError }
    }

    const { totalRewardsNormalized, error: totalRewardsError } = await this.getTotalRewards(quote)

    if (Boolean(totalRewardsError)) {
      return { error: totalRewardsError }
    }

    const ask = this.getAsk(totalFillNormalized, quote)

    return {
      error: isInsufficient(ask, totalRewardsNormalized)
        ? QuoteError.RouteIsInfeasable(ask, totalRewardsNormalized)
        : undefined,
    }
  }

  async isRewardFeasible(quote: QuoteIntentDataInterface): Promise<{ error?: Error }> {
    const { totalRewardsNormalized, error } = await this.getTotalRewards(quote)
    if (error) {
      return { error }
    }
    const fee = this.getFee(totalRewardsNormalized, quote)

    return {
      error:
        totalRewardsNormalized >= fee
          ? undefined
          : QuoteError.RewardIsInfeasable(fee, totalRewardsNormalized),
    }
  }

  /**
   * Calculates the total normalized fill for the quote intent
   *
   * @param quote the quote intent
   * @param useRouteTokens if true, uses tokens from route.tokens; if false, uses function targets from calls
   * @returns
   */
  async getTotalFill(
    quote: QuoteIntentDataInterface,
    useRouteTokens = false,
  ): Promise<{ totalFillNormalized: NormalizedTotal; error?: Error }> {
    const { calls, error } = await this.getCallsNormalized(quote, useRouteTokens)
    if (error) {
      return { totalFillNormalized: { token: 0n, native: 0n }, error }
    }

    const totalFillNormalized: NormalizedTotal = calls.reduce(
      (acc, call) => {
        return {
          token: acc.token + call.balance,
          native: acc.native + call.native.amount,
        }
      },
      { token: 0n, native: 0n },
    )
    return { totalFillNormalized }
  }

  /**
   * Calculates the total normalized and acceoted rewards for the quote intent
   * @param quote the quote intent
   * @returns
   */
  async getTotalRewards(
    quote: QuoteIntentDataInterface,
  ): Promise<{ totalRewardsNormalized: NormalizedTotal; error?: Error }> {
    const { rewards, error } = await this.getRewardsNormalized(quote)

    if (error) {
      return { totalRewardsNormalized: { token: 0n, native: 0n }, error }
    }
    const rewardSum = rewards.reduce((acc, reward) => {
      return acc + reward.balance
    }, 0n)
    return { totalRewardsNormalized: { token: rewardSum, native: quote.reward.nativeValue } }
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
      .find((intent) => BigInt(intent.chainID) == srcChainID)
    const destination = this.ecoConfigService
      .getIntentSources()
      .find((intent) => BigInt(intent.chainID) == destChainID)
    const solver = this.ecoConfigService.getSolver(destChainID)

    if (!source || !destination || !solver) {
      let error: Error | undefined
      if (!source) {
        error = QuoteError.NoIntentSourceForSource(srcChainID)
      } else if (!destination) {
        error = QuoteError.NoIntentSourceForDestination(destChainID)
      } else if (!solver) {
        error = QuoteError.NoSolverForDestination(destChainID)
      }

      this.logger.error(
        EcoLogMessage.fromDefault({
          message: error!.message,
          properties: {
            error,
            source,
            solver,
          },
        }),
      )
      return { error }
    }

    //Get the tokens the solver accepts on the source chain
    const srcBalance = await this.balanceService.fetchTokenData(Number(srcChainID))
    if (!srcBalance) {
      throw QuoteError.FetchingCallTokensFailed(quote.route.source)
    }
    const srcDeficitDescending = srcBalance
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

    //Get the tokens the solver accepts on the destination chain
    const destBalance = await this.balanceService.fetchTokenData(Number(destChainID))
    if (!destBalance) {
      throw QuoteError.FetchingCallTokensFailed(quote.route.destination)
    }
    const destDeficitDescending = destBalance
      .filter((tokenAnalysis) => destination.tokens.includes(tokenAnalysis.token.address))
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
    const { tokens, error: errorTokens } = await this.getTokensNormalized(quote)
    const { calls, error: errorCalls } = await this.getCallsNormalized(quote)
    if (errorCalls || errorTokens || errorRewards) {
      return { error: errorCalls || errorTokens || errorRewards }
    }
    return {
      calculated: {
        solver,
        rewards,
        tokens,
        calls,
        srcDeficitDescending, //token liquidity with deficit first descending
        destDeficitDescending,
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

    // If there are no accepted tokens, but the quote is native intent, we return an empty rewards array
    if (acceptedTokens.length === 0 && isNativeIntent(quote)) {
      return { rewards: [] }
    }

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
        if (!token) {
          throw QuoteError.RewardTokenNotFound(tb.address)
        }
        return this.convertNormalize(token.amount, {
          chainID: srcChainID,
          address: tb.address,
          decimals: tb.decimals,
        })
      }),
    }
  }

  async getTokensNormalized(
    quote: QuoteIntentDataInterface,
  ): Promise<{ tokens: NormalizedToken[]; error?: Error }> {
    const destChainID = quote.route.destination
    const source = this.ecoConfigService
      .getIntentSources()
      .find((intent) => BigInt(intent.chainID) == destChainID)

    if (!source) {
      return { tokens: [], error: QuoteError.NoIntentSourceForDestination(destChainID) }
    }

    const acceptedTokens = quote.route.tokens
      .filter((route) => source.tokens.includes(route.token))
      .map((route) => route.token)

    // If there are no accepted tokens, but the quote is native intent, we return an empty tokens array
    if (acceptedTokens.length === 0 && isNativeIntent(quote)) {
      return { tokens: [] }
    }

    const erc20Rewards = await this.balanceService.fetchTokenBalances(
      Number(destChainID),
      acceptedTokens,
    )
    if (Object.keys(erc20Rewards).length === 0) {
      return { tokens: [], error: QuoteError.FetchingRewardTokensFailed(BigInt(destChainID)) }
    }

    return {
      tokens: Object.values(erc20Rewards).map((tb) => {
        const token = quote.route.tokens.find((route) => getAddress(route.token) === tb.address)
        if (!token) {
          throw QuoteError.RouteTokenNotFound(tb.address)
        }
        return this.convertNormalize(token.amount, {
          chainID: destChainID,
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
   * Throws if there is not enough liquidity for the call
   *
   * @param quote the quote intent
   * @param useRouteTokens if true, uses tokens from route.tokens; if false, uses function targets from calls
   * @returns
   */
  async getCallsNormalized(
    quote: QuoteIntentDataInterface,
    useRouteTokens = false,
  ): Promise<{
    calls: NormalizedCall[]
    error: Error | undefined
  }> {
    const solver = this.ecoConfigService.getSolver(quote.route.destination)
    if (!solver) {
      return { calls: [], error: QuoteError.NoSolverForDestination(quote.route.destination) }
    }

    const functionTargets = getIntentTokens(quote, useRouteTokens)

    // Function targets can be an empty array for a quote that only has native calls.
    if (functionTargets.length === 0 && isNativeIntent(quote)) {
      const nativeCalls = this.getNormalizedNativeCalls(quote, solver.chainID)
      return { calls: nativeCalls, error: undefined }
    }

    const callERC20Balances = await this.balanceService.fetchTokenBalances(
      solver.chainID,
      functionTargets,
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
    let calls: NormalizedCall[] = []

    try {
      const functionalCalls = useRouteTokens
        ? getTransferFromTokens(quote.route.tokens)
        : getFunctionCalls(quote.route.calls as CallDataInterface[])

      calls = functionalCalls.map((call) => {
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

        if (!ttd?.decodedFunctionData?.args || ttd.decodedFunctionData.args.length < 2) {
          throw QuoteError.InvalidFunctionData(call.target)
        }
        const recipient = ttd.decodedFunctionData.args[0] as Hex
        const transferAmount = ttd.decodedFunctionData.args[1] as bigint
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

        return {
          ...this.convertNormalize(transferAmount, {
            chainID: BigInt(solver.chainID),
            address: call.target,
            decimals: callTarget.token.decimals,
          }),
          recipient,
          native: {
            amount: call.value,
          },
        }
      })

      const nativeCalls = this.getNormalizedNativeCalls(quote, solver.chainID)
      calls.push(...nativeCalls)
    } catch (e) {
      error = e
    }

    return { calls, error }
  }

  private getNormalizedNativeCalls(
    quote: QuoteIntentDataInterface,
    chainID: number,
  ): NormalizedCall[] {
    return getNativeCalls(quote.route.calls as CallDataInterface[]).map((call) => ({
      recipient: call.target,
      native: {
        amount: call.value,
      },
      // we don't have a token for native calls, so we use a dummy token
      balance: 0n,
      chainID: BigInt(chainID),
      address: zeroAddress,
      decimals: 0,
    }))
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
    //todo some conversion, assuming here 1-1
    return {
      ...token,
      balance: normalizeBalance({ balance: value, decimal: BASE_DECIMALS }, token.decimals).balance,
    }
  }

  private getRouteDestinationSolverFee(route: QuoteRouteDataInterface): FeeConfigType {
    const solverFee = this.getAskRouteDestinationSolver(route).fee

    // Return solver fee if it has valid structure, otherwise use default
    return solverFee?.constants ? solverFee : this.intentConfigs.defaultFee
  }

  /**
   * Returbs the default route destination solver, unless its a ethereum L1 (mainnet or sepolia).
   * In which case it returns that one instead
   *
   * @param route The route of the quote intent
   * @returns
   */
  getAskRouteDestinationSolver(route: QuoteRouteDataInterface) {
    // Constants for Ethereum mainnet and sepolia chain IDs
    const ETH_MAINNET = 1n
    const ETH_SEPOLIA = 11155111n

    // Use Ethereum L1 chain if either source or destination is L1
    const destination =
      route.destination === ETH_MAINNET || route.source === ETH_MAINNET
        ? ETH_MAINNET
        : route.destination === ETH_SEPOLIA || route.source === ETH_SEPOLIA
          ? ETH_SEPOLIA
          : route.destination

    const solver = this.ecoConfigService.getSolver(destination)
    if (!solver) {
      //we shouldn't get here after validations are run so throw
      throw QuoteError.NoSolverForDestination(destination)
    }
    return solver
  }
}
