import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getERC20Selector, RewardTokensInterface } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeasibilityService } from '@/intent/feasibility.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { validationsSucceeded, ValidationService } from '@/intent/validation.sevice'
import { QuoteIntentDataDTO, QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import {
  InfeasibleQuote,
  InsolventUnprofitableQuote,
  InsufficientBalance,
  InternalQuoteError,
  InternalSaveError,
  InvalidQuote,
  InvalidQuoteIntent,
  Quote400,
  QuoteError,
  SolverUnsupported,
} from '@/quote/errors'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { Mathb } from '@/utils/bigint'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as dayjs from 'dayjs'
import { BalanceService, TokenFetchAnalysis } from '@/balance/balance.service'
import { normalizeBalance } from '@/quote/utils'
import { getAddress, Hex, Prettify } from 'viem'
import { Solver } from '@/eco-configs/eco-config.types'

/**
 * The response quote data
 */
export interface QuoteData {
  tokens: RewardTokensInterface[]
  expiryTime: string
}

/**
 * The normalized tokens for the quote intent
 */
export interface NormalizedTokens {
  rewardTokens: RewardTokensInterface[]
  callTokens: RewardTokensInterface[]
}

/**
 * The normalized token type
 */
export type NormalizedToken = {
  balance: bigint
  chainID: bigint
  address: Hex
  decimals: number
}

/**
 * The type for the token fetch analysis with the normalized delta
 */
type DeficitDescending = Prettify<TokenFetchAnalysis & { delta: NormalizedToken }>

/**
 * The type for the calculated tokens
 */
type CalculateTokensType = {
  solver: Solver
  rewards: NormalizedToken[]
  calls: NormalizedToken[]
  deficitDescending: DeficitDescending[]
}

/**
 * The base decimal number for erc20 tokens.
 */
export const BASE_DECIMALS: number = 6

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnApplicationBootstrap {
  private logger = new Logger(QuoteService.name)

  constructor(
    @InjectModel(QuoteIntentModel.name) private quoteIntentModel: Model<QuoteIntentModel>,
    private readonly balanceService: BalanceService,
    private readonly validationService: ValidationService,
    private readonly feasibilityService: FeasibilityService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  async onApplicationBootstrap() {}

  /**
   * Generates a quote for the quote intent data.
   * The network quoteIntentDataDTO is stored in the db.
   *
   * @param quoteIntentDataDTO the quote intent data
   * @returns
   */
  async getQuote(quoteIntentDataDTO: QuoteIntentDataDTO) {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Getting quote for intent`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )
    const quoteIntent = await this.storeQuoteIntentData(quoteIntentDataDTO)
    if (quoteIntent instanceof Error) {
      return InternalSaveError(quoteIntent)
    }
    const res = await this.validateQuoteIntentData(quoteIntent)
    if (res) {
      return res
    }

    return await this.generateQuote(quoteIntent)
  }

  /**
   * Stores the quote into the db
   * @param quoteIntentDataDTO the quote intent data
   * @returns the stored record or an error
   */
  async storeQuoteIntentData(
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): Promise<QuoteIntentModel | Error> {
    try {
      const record = await this.quoteIntentModel.create(quoteIntentDataDTO)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Recorded quote intent`,
          properties: {
            record,
          },
        }),
      )
      return record
    } catch (e) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in storeQuoteIntentData`,
          properties: {
            quoteIntentDataDTO,
            error: e,
          },
        }),
      )
      return e
    }
  }

  /**
   * Validates that the quote intent data is valid.
   * Checks that there is a solver, that the assert validations pass,
   * and that the quote intent is feasible.
   * @param quoteIntentModel the model to validate
   * @returns an res 400, or undefined if the quote intent is valid
   */
  async validateQuoteIntentData(quoteIntentModel: QuoteIntentModel): Promise<Quote400 | undefined> {
    const solver = this.ecoConfigService.getSolver(quoteIntentModel.route.destination)
    if (!solver) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: No solver found for destination : ${quoteIntentModel.route.destination}`,
          properties: {
            quoteIntentModel,
          },
        }),
      )
      await this.updateQuoteDb(quoteIntentModel, { error: SolverUnsupported })
      return SolverUnsupported
    }

    const validations = await this.validationService.assertValidations(quoteIntentModel, solver)
    if (!validationsSucceeded(validations)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: Some validations failed`,
          properties: {
            quoteIntentModel,
            validations,
          },
        }),
      )
      await this.updateQuoteDb(quoteIntentModel, { error: InvalidQuoteIntent(validations) })
      return InvalidQuoteIntent(validations)
    }

    const { feasable, results } = await this.feasibilityService.validateExecution(
      quoteIntentModel,
      solver,
    )

    if (!feasable) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: quote intent is not feasable ${quoteIntentModel._id}`,
          properties: {
            quoteIntentModel,
            feasable,
          },
        }),
      )
      await this.updateQuoteDb(quoteIntentModel, { error: InfeasibleQuote(results) })
      return InfeasibleQuote(results)
    } else if (!results) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: quote intent is not valid ${quoteIntentModel._id}`,
          properties: {
            quoteIntentModel,
            results,
          },
        }),
      )
      await this.updateQuoteDb(quoteIntentModel, { error: InvalidQuote(results) })
      return InvalidQuote(results)
    } else {
      const res = results as [{ solvent: boolean; profitable: boolean }]
      if (res.some((r) => !r.solvent || !r.profitable)) {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `validateQuoteIntentData: quote intent is not solvent or profitable ${quoteIntentModel._id}`,
            properties: {
              quoteIntentModel,
              results,
            },
          }),
        )
        await this.updateQuoteDb(quoteIntentModel, { error: InsolventUnprofitableQuote(results) })
        return InsolventUnprofitableQuote(results)
      }
    }
    return
  }

  /**
   * Generates a quote for the quote intent model. The quote is generated by:
   * 1. Converting the call and reward tokens to a standard reserve value for comparisons
   * 2. Adding a fee to the ask of the normalized call tokens
   * 3. Fulfilling the ask with the reward tokens starting with any deficit tokens the solver
   * has on the source chain
   * 4. If there are any remaining tokens, they are used to fulfill the solver token
   * starting with the smallest delta
   * @param quoteIntentModel the quote intent model
   * @returns the quote or an error 400 for insufficient reward to generate the quote
   */
  async generateQuote(quoteIntentModel: QuoteIntentDataInterface) {
    const calculated = await this.calculateTokens(quoteIntentModel)
    if (typeof calculated === 'object' && 'error' in calculated) {
      return InternalQuoteError(calculated.error)
    }
    const { deficitDescending: fundable, calls, rewards } = calculated as CalculateTokensType

    const totalFulfill = calls.reduce((acc, call) => acc + call.balance, 0n)
    const totalAsk = totalFulfill * this.getFeeMultiplier(quoteIntentModel.route) + 10n
    const totalAvailableRewardAmount = rewards.reduce((acc, reward) => acc + reward.balance, 0n)
    if (totalAsk > totalAvailableRewardAmount) {
      return InsufficientBalance(totalAsk, totalAvailableRewardAmount)
    }
    let filled = 0n
    const quoteRecord: Record<Hex, RewardTokensInterface> = {}
    for (const deficit of fundable) {
      if (filled >= totalAsk) {
        break
      }
      const left = totalAsk - filled
      //Only fill defits first pass
      if (deficit.delta.balance < 0n) {
        const reward = rewards.find((r) => r.address === deficit.delta.address)
        if (reward) {
          const amount = Mathb.min(
            Mathb.min(Mathb.abs(deficit.delta.balance), reward.balance),
            left,
          )
          if (amount > 0n) {
            deficit.delta.balance -= amount
            reward.balance -= amount
            filled += amount
            //add to quote record
            const tokenToFund = quoteRecord[deficit.delta.address] || {
              token: deficit.delta.address,
              amount: 0n,
            }
            tokenToFund.amount += this.deconvertNormalize(amount, deficit.delta).balance
            quoteRecord[deficit.delta.address] = tokenToFund
          }
        }
      }
    }
    //resort fundable to reflect first round of fills
    fundable.sort((a, b) => -1 * Mathb.compare(a.delta.balance, b.delta.balance))

    //if remaining funds, for those with smallest deltas
    if (filled < totalAsk) {
      for (const deficit of fundable) {
        if (filled >= totalAsk) {
          break
        }
        const reward = rewards.find((r) => r.address === deficit.delta.address)
        if (reward) {
          const amount = Mathb.min(Mathb.abs(deficit.delta.balance), reward.balance)
          if (amount > 0n) {
            deficit.delta.balance -= amount
            reward.balance -= amount
            filled += amount
            //add to quote record
            const tokenToFund = quoteRecord[deficit.delta.address] || {
              token: deficit.delta.address,
              amount: 0n,
            }
            tokenToFund.amount += Mathb.abs(this.deconvertNormalize(amount, deficit.delta).balance)
            quoteRecord[deficit.delta.address] = tokenToFund
          }
        }
      }
    }

    //todo save quote to record
    return {
      tokens: Object.values(quoteRecord),
      expiryTime: this.getQuoteExpiryTime(),
    }
  }

  /**
   * Gets the solver tokens for the source chain and orders them in
   * a normalized delta descending order. delta = (balance - minBalance) * decimals
   * @param route the route
   * @returns
   */
  async calculateTokens(quote: QuoteIntentDataInterface): Promise<
    | CalculateTokensType
    | {
        error?: Error
      }
  > {
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
    const rewards = await this.getRewardsNormalized(quote)
    const calls = await this.getCallsNormalized(quote)
    return {
      solver,
      rewards,
      calls,
      deficitDescending,
    }
  }

  /**
   * Fetches the rewardes for the quote intent, grabs their info from the erc20 contracts and then converts
   * and normalizes their values
   * @param quote the quote intent
   */
  async getRewardsNormalized(quote: QuoteIntentDataInterface) {
    const srcChainID = quote.route.source
    const erc20Rewards = await this.balanceService.fetchTokenBalances(
      Number(srcChainID),
      quote.reward.tokens.map((reward) => reward.token),
    )

    return Object.values(erc20Rewards).map((tb) => {
      const token = quote.reward.tokens.find((reward) => getAddress(reward.token) === tb.address)
      return this.convertNormalize(token!.amount, {
        chainID: srcChainID,
        address: tb.address,
        decimals: tb.decimals,
      })
    })
  }

  /**
   * Fetches the call tokens for the quote intent, grabs their info from the erc20 contracts and then converts
   * to a standard reserve value for comparisons
   * @param quote the quote intent
   * @param solver the solver for the quote intent
   * @returns
   */
  async getCallsNormalized(quote: QuoteIntentDataInterface) {
    const solver = this.ecoConfigService.getSolver(quote.route.destination)
    if (!solver) {
      throw QuoteError.NoSolverForDestination(quote.route.destination)
    }
    const callERC20Balances = await this.balanceService.fetchTokenBalances(
      solver.chainID,
      quote.route.calls.map((call) => call.target),
    )
    if (Object.keys(callERC20Balances).length === 0) {
      throw QuoteError.FetchingCallTokensFailed(BigInt(solver.chainID))
    }

    return quote.route.calls.map((call) => {
      const ttd = this.utilsIntentService.getTransactionTargetData(quote, solver, call)
      if (!this.utilsIntentService.isERC20Target(ttd, getERC20Selector('transfer'))) {
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

      return this.convertNormalize(transferAmount, {
        chainID: BigInt(solver.chainID),
        address: call.target,
        decimals: callTarget.decimals,
      })
    })
  }

  /**
   * Gets the fee multiplier for the quote intent ask.
   *
   * @param route the route of the quote intent
   * @returns a bigint representing the fee multiplier
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getFeeMultiplier(route: QuoteRouteDataInterface) {
    //todo implement fee logic
    return 1n
  }

  /**
   * @returns the expiry time of the quote
   */
  getQuoteExpiryTime(): string {
    //todo implement expiry time logic
    return dayjs().add(5, 'minutes').unix().toString()
  }

  /**
   * Updates the quote intent model in the db
   * @param quoteIntentModel the model to update
   * @returns
   */
  async updateQuoteDb(quoteIntentModel: QuoteIntentModel, receipt?: any) {
    try {
      if (receipt) {
        quoteIntentModel.receipt = receipt
      }
      await this.quoteIntentModel.updateOne({ _id: quoteIntentModel._id }, quoteIntentModel)
    } catch (e) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in updateQuoteDb`,
          properties: {
            quoteIntentModel,
            error: e,
          },
        }),
      )
      return e
    }
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
