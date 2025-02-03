import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RewardTokensInterface } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeasibilityService } from '@/intent/feasibility.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { someFailedValidations, ValidationService } from '@/intent/validation.sevice'
import { QuoteIntentDataDTO, QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import {
  InfeasibleQuote,
  InsufficientBalance,
  InternalSaveError,
  InvalidQuoteIntent,
  Quote400,
  SolverUnsupported,
} from '@/quote/errors'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { Mathb } from '@/utils/bigint'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as dayjs from 'dayjs'
import { BalanceService, TokenFetchAnalysis } from '@/balance/balance.service'
import { denormalize, normalize } from '@/quote/utils'
import { getAddress, Hex } from 'viem'

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
 * The base decimal number for erc20 tokens.
 */
const BASE_DECIMALS: number = 6

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnApplicationBootstrap {
  private logger = new Logger(QuoteService.name)

  constructor(
    @InjectModel(QuoteIntentModel.name) private quoteIntentModel: Model<QuoteIntentModel>,
    private readonly validationService: ValidationService,
    private readonly balanceService: BalanceService,
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

  async storeQuoteIntentData(
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): Promise<QuoteIntentModel | Error> {
    try {
      const record = await this.quoteIntentModel.create(quoteIntentDataDTO.toQuoteIntentModel())
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
   *  and that the quote intent is feasible.
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
    if (someFailedValidations(validations)) {
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
    }

    return
  }

  async generateQuote(quoteIntentModel: QuoteIntentDataInterface) {
    const {
      deficitDescending: fundable,
      calls,
      rewards,
    } = await this.calculateTokens(quoteIntentModel)
    const totalFulfill = calls.reduce((acc, call) => acc + call.balance, 0n)
    const totalAsk = totalFulfill * this.getFeeMultiplier(quoteIntentModel.route)
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
  async calculateTokens(quote: QuoteIntentDataInterface) {
    const route = quote.route
    const srcChainID = route.source
    const destChainID = route.destination

    const source = this.ecoConfigService
      .getIntentSources()
      .find((intent) => BigInt(intent.chainID) == srcChainID)
    const solver = this.ecoConfigService.getSolver(destChainID)

    if (!source || !solver) {
      const err = new Error(
        `getSolverTokensDecending: No source/solver found for chain id ${destChainID}`,
      )
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: err.message,
          properties: {
            error: err,
            source,
            solver,
          },
        }),
      )
      throw err
    }

    //Get the tokens the solver accepts on the source chain
    const balance = await this.balanceService.fetchTokenData(Number(srcChainID))
    if (!balance) {
      throw new Error(`No tokens found for chain ${source.chainID}`)
    }
    const deficitDescending = Object.values(balance)
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

    return Object.values(erc20Rewards)
      .filter((tb) => {
        return quote.reward.tokens.find((reward) => getAddress(reward.token) === tb.address)
      })
      .map((tb) => {
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
      throw new Error(`No solver found for chain ${quote.route.destination}`)
    }
    const callERC20Balances = await this.balanceService.fetchTokenBalances(
      solver.chainID,
      quote.route.calls.map((call) => call.target),
    )
    if (!callERC20Balances || Object.keys(callERC20Balances).length === 0) {
      throw new Error(`Error occured when fetching call tokens for ${solver.chainID}`)
    }
    return quote.route.calls.map((call) => {
      const ttd = this.utilsIntentService.getTransactionTargetData(quote, solver, call)
      if (ttd && ttd.targetConfig.contractType === 'erc20') {
        const callTarget = callERC20Balances[call.target]
        if (!callTarget) {
          throw new Error(
            `Cannot resolve the decimals of a call target ${call.target} on chain ${solver.chainID}`,
          )
        }
        const transferAmount = ttd.decodedFunctionData.args
          ? (ttd.decodedFunctionData.args[1] as bigint)
          : 0n
        return this.convertNormalize(transferAmount, {
          chainID: BigInt(solver.chainID),
          address: call.target,
          decimals: callTarget.decimals,
        })
      } else {
        const err = new Error(`getNormalizedCallTokens: target not erc20`)
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: err.message,
            properties: {
              error: err,
              call,
            },
          }),
        )
        throw err
      }
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
      quoteIntentModel.receipt = receipt
        ? { previous: quoteIntentModel.receipt, current: receipt }
        : receipt
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
    const delta =
      token.balance.balance - normalize(BigInt(token.config.minBalance), token.balance.decimals)
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
  convertNormalize(value: bigint, token: { chainID: bigint; address: Hex; decimals: number }) {
    const original = value
    //todo some conversion, assuming here 1-1
    return {
      ...token,
      balance: normalize(original, BASE_DECIMALS / token.decimals),
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
      balance: denormalize(original, BASE_DECIMALS / token.decimals),
    }
  }
}
