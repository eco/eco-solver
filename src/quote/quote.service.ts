import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RewardTokensInterface } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Solver } from '@/eco-configs/eco-config.types'
import { FeasibilityService } from '@/intent/feasibility.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import {
  someFailedValidations,
  ValidationIntentInterface,
  ValidationService,
} from '@/intent/validation.sevice'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { TokenDataAnalyzed } from '@/liquidity-manager/types/types'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import {
  InfeasibleQuote,
  InsufficientBalance,
  InternalQuoteError,
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
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnApplicationBootstrap {
  private logger = new Logger(QuoteService.name)

  constructor(
    @InjectModel(QuoteIntentModel.name) private quoteIntentModel: Model<QuoteIntentModel>,
    private readonly liquidityService: LiquidityManagerService,
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

  /**
   *
   * @param quoteIntentModel
   * @returns
   */
  async generateQuote(quoteIntentModel: QuoteIntentModel) {
    //get the solver tokens we want funded
    const { solver, deficitDescending } = await this.getSolverTokensDescending(
      quoteIntentModel.route,
    )

    //get the total normalized reward tokens the user wants to pay
    const normalized = this.getNormalizedTokens(quoteIntentModel, solver)

    return this.calculateQuote(quoteIntentModel.route, normalized, deficitDescending)
  }

  /**
   * Calculates the quote for the quote intent
   *
   * @param route the route of the quote intent
   * @param normalizedTokens the normalized tokens for the quote intent
   * @param deficitDescending the solver tokens on the destination chain in descending order
   * @returns the quote data
   */
  calculateQuote(
    route: QuoteRouteDataInterface,
    normalizedTokens: NormalizedTokens,
    deficitDescending: TokenDataAnalyzed[],
  ) {
    const quote: QuoteData = {
      tokens: [],
      expiryTime: this.getQuoteExpiryTime(),
    }

    const { callTokens, rewardTokens } = normalizedTokens
    const totalFulfillmentAmount = callTokens.reduce((acc, token) => acc + token.amount, 0n)
    const totalAsk = totalFulfillmentAmount * this.getFeeMultiplier(route)
    const totalAvailableRewardAmount = rewardTokens.reduce((acc, token) => acc + token.amount, 0n)
    if (totalAsk > totalAvailableRewardAmount) {
      //todo save to db
      return InsufficientBalance(totalAsk, totalAvailableRewardAmount)
    }
    let filled = 0n

    //put together the quote starting with deficit tokens
    //todo when it rebalances everything and still reward tokens left to split
    for (const token of deficitDescending) {
      const neededForToken = BigInt(Math.ceil(token.analysis.diff))

      //get the max amount we can get towards rebalance this token completely
      const rebalanceAmount = Mathb.min(neededForToken, totalAsk - filled)
      //find matching
      const rewardToken = rewardTokens.find((ct) => ct.token === token.config.address)
      if (!rewardToken) {
        continue
      }
      const askTransfer = Mathb.min(rebalanceAmount, rewardToken.amount)
      quote.tokens.push(
        this.feasibilityService.deNormalizeToken(route.source, {
          token: rewardToken.token,
          amount: askTransfer,
        }),
      )
      filled += askTransfer
      if (filled >= totalAsk) {
        break
      }
    }
    const leftOver = totalAsk - filled > 0n
    if (leftOver) {
      //todo save to db
      return InsufficientBalance(totalAsk, totalAvailableRewardAmount)
    }

    return filled >= totalAsk ? quote : InternalQuoteError()
  }

  // getQuoteTokens(deficitDescending: TokenDataAnalyzed[], rewardTokens: RewardTokensInterface[], totalAsk: bigint) {
  //   let filled = 0n
  //   while()
  //   for (const token of deficitDescending) {
  //     const neededForToken = BigInt(Math.ceil(token.analysis.diff))

  //     //get the max amount we can get towards rebalance this token completely
  //     const rebalanceAmount = Mathb.min(neededForToken, totalAsk - filled)
  //     //find matching
  //     const rewardToken = rewardTokens.find((ct) =>
  //       ct.token === token.config.address
  //     )
  //     if (!rewardToken) {
  //       continue
  //     }
  //     const askTransfer = Mathb.min(rebalanceAmount, rewardToken.amount)
  //     quote.tokens.push(
  //       this.feasibilityService.deNormalizeToken(route.source, {
  //         token: rewardToken.token,
  //         amount: askTransfer,
  //       }),
  //     )
  //     filled += askTransfer
  //     if (filled >= totalAsk) {
  //       break
  //     }
  //   }
  // }
  /**
   * Gets the normalized destination target call tokens for the quote intent.
   * The normalization involves converting all the tokens into the same base so they
   * can be compared. Targets must be erc20 tokens, else it throws an error.
   * Assumes tokens are 6 decimals
   * @param quote the quote intent model
   * @param solver the solver for the quote intent
   * @returns an array of the normalized tokens
   */
  getNormalizedTokens(quote: ValidationIntentInterface, solver: Solver) {
    const destChainID = quote.route.destination
    const srcChainID = quote.route.source
    const normCallTokens = quote.route.calls.map((call) => {
      const ttd = this.utilsIntentService.getTransactionTargetData(quote, solver, call)
      if (ttd && ttd.targetConfig.contractType === 'erc20') {
        const transferAmount = ttd.decodedFunctionData.args
          ? (ttd.decodedFunctionData.args[1] as bigint)
          : 0n
        return this.feasibilityService.normalizeToken(destChainID, {
          token: call.target,
          amount: transferAmount,
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
    const normRewardTokens = quote.reward.tokens.map((reward) =>
      this.feasibilityService.normalizeToken(srcChainID, reward),
    )

    return {
      callTokens: normCallTokens,
      rewardTokens: normRewardTokens,
    }
  }

  /**
   * Gets the solver tokens on the destination chain in descending order
   * from the ones most in deficit to the ones most in surplus
   * @param route the intent route
   * @returns The destination solver and the intent source (accepted ∩ reward) tokens
   */
  async getSolverTokensDescending(route: QuoteRouteDataInterface) {
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

    const acceptedTokens = source.tokens
    //Get the tokens the solver accepts on the source chain
    const { surplus, inrange, deficit } = await this.liquidityService.analyzeTokens()
    const filterTokens = (items: TokenDataAnalyzed[]) => {
      return items.filter(
        (token) =>
          BigInt(token.chainId) == srcChainID && acceptedTokens.includes(token.config.address),
      )
    }
    surplus.items = filterTokens(surplus.items)
    inrange.items = filterTokens(inrange.items)
    deficit.items = filterTokens(deficit.items)

    //Sort tokens with leading deficits than: inrange/surplus reordered in accending order
    const deficitDescending = deficit.items
      .concat(inrange.items.reverse())
      .concat(surplus.items.reverse())
    return {
      solver,
      deficitDescending,
    }
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
}
