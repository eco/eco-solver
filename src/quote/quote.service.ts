import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RewardTokensInterface } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { validationsSucceeded, ValidationService } from '@/intent/validation.sevice'
import { QuoteIntentDataDTO, QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
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
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as dayjs from 'dayjs'
import { encodeFunctionData, erc20Abi, Hex } from 'viem'
import { FeeService } from '@/fee/fee.service'
import { CalculateTokensType } from '@/fee/types'
import { EcoResponse } from '@/common/eco-response'
import { QuotesConfig } from '@/eco-configs/eco-config.types'
import { QuoteDataEntryDTO } from '@/quote/dto/quote-data-entry.dto'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteRewardTokensDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteCallDataDTO } from '@/quote/dto/quote.route.data.dto'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnModuleInit {
  private logger = new Logger(QuoteService.name)
  private quotesConfig: QuotesConfig

  constructor(
    @InjectModel(QuoteIntentModel.name) private quoteIntentModel: Model<QuoteIntentModel>,
    private readonly feeService: FeeService,
    private readonly validationService: ValidationService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  onModuleInit() {
    this.quotesConfig = this.ecoConfigService.getQuotesConfig()
  }

  /**
   * Generates a quote for the quote intent data.
   * The network quoteIntentDataDTO is stored in the db.
   *
   * @param quoteIntentDataDTO the quote intent data
   * @returns
   */
  async getQuote(quoteIntentDataDTO: QuoteIntentDataDTO): Promise<EcoResponse<QuoteDataDTO>> {
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
      return { error: InternalSaveError(quoteIntent) }
    }
    const res = await this.validateQuoteIntentData(quoteIntent)
    if (res) {
      return { error: res }
    }

    const { response: quoteData, error } = await this.getQuotesForIntentTypes(quoteIntentDataDTO)
    await this.updateQuoteDb(quoteIntent, { quoteData, error })

    if (error) {
      return { error }
    }

    return { response: quoteData }
  }

  async getReverseQuote(
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): Promise<EcoResponse<QuoteDataDTO>> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Getting reverse quote for intent`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )
    const quoteIntent = await this.storeQuoteIntentData(quoteIntentDataDTO)
    if (quoteIntent instanceof Error) {
      return { error: InternalSaveError(quoteIntent) }
    }
    const res = await this.validateQuoteIntentData(quoteIntent, true)
    if (res) {
      return { error: res }
    }
    const { response: quoteData, error } = await this.getQuotesForIntentTypes(quoteIntent, true)
    await this.updateQuoteDb(quoteIntent, { quoteData, error })
    if (error) {
      return { error }
    }
    return { response: quoteData }
  }

  /**
   * Generates quotes for a set of IntentExecutionTypes. Supported types are configured in the
   * quotesConfig. Currently only self publish and gasless are supported.
   * @param quoteIntentModel parameters for the quote
   * @returns the quote or an error
   */
  async getQuotesForIntentTypes(
    quoteIntent: QuoteIntentDataInterface,
    isReverseQuote: boolean = false,
  ): Promise<EcoResponse<QuoteDataDTO>> {
    const quoteEntries: QuoteDataEntryDTO[] = []

    for (const intentExecutionType of this.quotesConfig.intentExecutionTypes) {
      const { response: quoteDataEntry, error } = await this.generateQuoteForIntentExecutionType(
        quoteIntent,
        IntentExecutionType.fromString(intentExecutionType)!,
        isReverseQuote,
      )

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Error getting quote for: ${intentExecutionType}`,
            properties: {
              error,
            },
          }),
        )
        continue
      }

      quoteEntries.push(quoteDataEntry!)
    }

    if (quoteEntries.length === 0) {
      return { error: InternalQuoteError(new Error('No quotes generated')) }
    }

    return {
      response: {
        quoteEntries,
      },
    }
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
   * Fetch a quote from the db
   * @param query the quote intent data
   * @returns the quote or an error
   */
  async fetchQuoteIntentData(query: object): Promise<QuoteIntentModel | null> {
    return this.quoteIntentModel.findOne(query)
  }

  /**
   * Validates that the quote intent data is valid.
   * Checks that there is a solver, that the assert validations pass,
   * and that the quote intent is feasible.
   * @param quoteIntentModel the model to validate
   * @returns an res 400, or undefined if the quote intent is valid
   */
  async validateQuoteIntentData(
    quoteIntentModel: QuoteIntentModel,
    isReverseQuote: boolean = false,
  ): Promise<Quote400 | undefined> {
    const solver = this.ecoConfigService.getSolver(quoteIntentModel.route.destination)
    if (!solver) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: No solver found for destination : ${quoteIntentModel.route.destination}`,
          properties: {
            quoteIntentModel,
            isReverseQuote,
          },
        }),
      )
      await this.updateQuoteDb(quoteIntentModel, { error: SolverUnsupported })
      return SolverUnsupported
    }

    const validations = await this.validationService.assertValidations(
      quoteIntentModel,
      solver,
      isReverseQuote,
    )
    if (!validationsSucceeded(validations)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: Some validations failed`,
          properties: {
            quoteIntentModel,
            validations,
            isReverseQuote,
          },
        }),
      )
      await this.updateQuoteDb(quoteIntentModel, { error: InvalidQuoteIntent(validations) })
      return InvalidQuoteIntent(validations)
    }

    let error: Error | undefined
    if (isReverseQuote) {
      const { error: reverseQuoteError } = await this.feeService.isRewardFeasible(quoteIntentModel)
      error = reverseQuoteError
    } else {
      const { error: defaultQuoteError } = await this.feeService.isRouteFeasible(quoteIntentModel)
      error = defaultQuoteError
    }

    if (error) {
      const quoteError = InfeasibleQuote(error)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: quote intent is not feasable ${quoteIntentModel._id}`,
          properties: {
            quoteIntentModel,
            feasable: false,
            error: quoteError,
            isReverseQuote,
          },
        }),
      )
      await this.updateQuoteDb(quoteIntentModel, { error: quoteError })
      return quoteError
    }
    return
  }

  private async generateBaseQuote(
    quoteIntentModel: QuoteIntentDataInterface,
    isReverseQuote: boolean = false,
  ): Promise<EcoResponse<QuoteDataEntryDTO>> {
    try {
      if (isReverseQuote) {
        return await this.generateReverseQuote(quoteIntentModel)
      } else {
        return await this.generateQuote(quoteIntentModel)
      }
    } catch (e) {
      return { error: InternalQuoteError(e) }
    }
  }

  /**
   * Generates a quote for given IntentExecutionType
   * @param quoteIntentModel parameters for the quote
   * @param intentExecutionType the intent execution type
   * @returns the quote or an error
   */
  private async generateQuoteForIntentExecutionType(
    quoteIntentModel: QuoteIntentDataInterface,
    intentExecutionType: IntentExecutionType,
    isReverseQuote: boolean = false,
  ): Promise<EcoResponse<QuoteDataEntryDTO>> {
    switch (true) {
      case intentExecutionType.isSelfPublish():
        return this.generateQuoteForSelfPublish(quoteIntentModel, isReverseQuote)

      case intentExecutionType.isGasless():
        return this.generateQuoteForGasless(quoteIntentModel, isReverseQuote)

      default:
        return {
          error: InternalQuoteError(
            new Error(`Unsupported intent execution type: ${intentExecutionType}`),
          ),
        }
    }
  }

  /**
   * Generates a quote for the self publish case.
   * @param quoteIntentModel parameters for the quote
   * @returns the quote or an error
   */
  async generateQuoteForSelfPublish(
    quoteIntentModel: QuoteIntentDataInterface,
    isReverseQuote: boolean = false,
  ): Promise<EcoResponse<QuoteDataEntryDTO>> {
    const { response: quoteDataEntry, error } = await this.generateBaseQuote(
      quoteIntentModel,
      isReverseQuote,
    )

    if (error) {
      return { error }
    }

    // We wil just use the base quote as is for the self publish case
    quoteDataEntry!.intentExecutionType = IntentExecutionType.SELF_PUBLISH.toString()
    return { response: quoteDataEntry }
  }

  /**
   * Generates a quote for the gasless case.
   * @param quoteIntentModel parameters for the quote
   * @returns the quote or an error
   */
  async generateQuoteForGasless(
    quoteIntentModel: QuoteIntentDataInterface,
    isReverseQuote: boolean = false,
  ): Promise<EcoResponse<QuoteDataEntryDTO>> {
    const { response: quoteDataEntry, error } = await this.generateBaseQuote(
      quoteIntentModel,
      isReverseQuote,
    )

    if (error) {
      return { error }
    }

    // todo: figure out what extra fee should be added to the base quote to cover our gas costs for the gasless intent
    quoteDataEntry!.intentExecutionType = IntentExecutionType.GASLESS.toString()
    return { response: quoteDataEntry }
  }

  /**
   * Generates a quote for the quote intent model. The quote is generated by:
   * 1. Converting the call and reward tokens to a standard reserve value for comparisons
   * 2. Adding a fee to the ask of the normalized call tokens
   * 3. Fulfilling the ask with the reward tokens starting with any deficit tokens the solver
   * has on the source chain
   * 4. If there are any remaining tokens, they are used to fulfill the solver token
   * starting with the smallest delta(minBalance - balance) tokens
   * @param quoteIntentModel the quote intent model
   * @returns the quote or an error 400 for insufficient reward to generate the quote
   */
  async generateQuote(
    quoteIntentModel: QuoteIntentDataInterface,
  ): Promise<EcoResponse<QuoteDataEntryDTO>> {
    const { calculated, error } = await this.feeService.calculateTokens(quoteIntentModel)
    if (error || !calculated) {
      return { error: InternalQuoteError(error) }
    }

    const { srcDeficitDescending: fundable, calls, rewards } = calculated as CalculateTokensType

    const totalFulfill = calls.reduce((acc, call) => acc + call.balance, 0n)
    const totalAsk = this.feeService.getAsk(totalFulfill, quoteIntentModel)
    const totalAvailableRewardAmount = rewards.reduce((acc, reward) => acc + reward.balance, 0n)
    if (totalAsk > totalAvailableRewardAmount) {
      return { error: InsufficientBalance(totalAsk, totalAvailableRewardAmount) }
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
            deficit.delta.balance += amount
            reward.balance -= amount
            filled += amount
            //add to quote record
            const tokenToFund = quoteRecord[deficit.delta.address] || {
              token: deficit.delta.address,
              amount: 0n,
            }
            tokenToFund.amount += this.feeService.deconvertNormalize(amount, deficit.delta).balance
            quoteRecord[deficit.delta.address] = tokenToFund
          }
        }
      }
    }
    //resort fundable to reflect first round of fills
    fundable.sort((a, b) => Mathb.compare(a.delta.balance, b.delta.balance))

    //if remaining funds, for those with smallest deltas
    if (filled < totalAsk) {
      for (const deficit of fundable) {
        if (filled >= totalAsk) {
          break
        }
        const left = totalAsk - filled
        const reward = rewards.find((r) => r.address === deficit.delta.address)
        if (reward) {
          const amount = Mathb.min(left, reward.balance)
          if (amount > 0n) {
            deficit.delta.balance += amount
            reward.balance -= amount
            filled += amount
            //add to quote record
            const tokenToFund = quoteRecord[deficit.delta.address] || {
              token: deficit.delta.address,
              amount: 0n,
            }
            tokenToFund.amount += Mathb.abs(
              this.feeService.deconvertNormalize(amount, deficit.delta).balance,
            )
            quoteRecord[deficit.delta.address] = tokenToFund
          }
        }
      }
    }

    //todo save quote to record
    return {
      response: {
        routeTokens: quoteIntentModel.route.tokens,
        routeCalls: quoteIntentModel.route.calls,
        rewardTokens: Object.values(quoteRecord) as QuoteRewardTokensDTO[],
        expiryTime: this.getQuoteExpiryTime(),
      } as QuoteDataEntryDTO,
    }
  }

  /**
   * Generates a reverse quote for the quote intent model. The quote is generated by:
   * 1. Converting the call and reward tokens to a standard reserve value for comparisons
   * 2. Subtracting the fee from the normalized reward tokens
   * 3. Distributing the remaining reward amount to the calls starting with the tokens the solver needs the least
   * @param intent the quote intent model
   * @returns the quote or an error 400 for insufficient reward to generate the quote
   */
  async generateReverseQuote(
    intent: QuoteIntentDataInterface,
  ): Promise<EcoResponse<QuoteDataEntryDTO>> {
    const { calculated, error } = await this.feeService.calculateTokens(intent)
    if (error || !calculated) {
      return { error: InternalQuoteError(error) }
    }

    const {
      destDeficitDescending: fundable,
      rewards,
      tokens,
      calls,
    } = calculated as CalculateTokensType

    const totalReward = rewards.reduce((acc, reward) => acc + reward.balance, 0n)
    const fee = this.feeService.getFee(totalReward, intent)

    if (fee >= totalReward) {
      return { error: InsufficientBalance(fee, totalReward) }
    }

    // Calculate total amount available after fee subtraction
    const totalAvailableAfterFee = totalReward - fee
    let remainingToFill = totalAvailableAfterFee

    const routeCalls = [] as QuoteCallDataDTO[]
    const routeTokens = [] as QuoteRewardTokensDTO[]

    // Sort calls by which ones the solver needs the least
    // Sort from best to fill (least needed) to worst (most needed)
    fundable.sort((a, b) => Mathb.compare(b.delta.balance, a.delta.balance))

    // Fill tokens that the solver needs the least first, up to their original amount
    for (const deficit of fundable) {
      if (remainingToFill <= 0n) {
        break
      }

      // Find the corresponding token in route.tokens and calls
      const originalToken = tokens.find((token) => token.address === deficit.delta.address)
      const originalCall = calls.find((call) => call.address === deficit.delta.address)

      if (originalToken && originalCall) {
        // Get the original amount from the token in its normalized form
        const originalNormalizedAmount = this.feeService.convertNormalize(
          BigInt(originalToken.balance),
          {
            chainID: intent.route.destination,
            address: deficit.delta.address,
            decimals: deficit.token.decimals,
          },
        ).balance

        // Calculate how much we can fill for this token
        // We cannot fill more than the original amount or the remaining amount to fill
        const amountToFill = Mathb.min(originalNormalizedAmount, remainingToFill)

        if (amountToFill > 0n) {
          // Convert back to original decimals
          const finalAmount = this.feeService.deconvertNormalize(amountToFill, {
            chainID: intent.route.destination,
            address: deficit.delta.address,
            decimals: deficit.token.decimals,
          }).balance

          // Add to route tokens and calls
          routeTokens.push({
            token: originalToken.address,
            amount: finalAmount,
          })

          const newData = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [originalCall.recipient, finalAmount],
          })

          routeCalls.push({
            target: originalCall.address,
            data: newData,
            value: 0n,
          })

          // Update remaining amount to fill
          remainingToFill -= amountToFill
        }
      }
    }

    return {
      response: {
        routeTokens,
        routeCalls,
        rewardTokens: intent.reward.tokens,
        expiryTime: this.getQuoteExpiryTime(),
      } as QuoteDataEntryDTO,
    }
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
}
