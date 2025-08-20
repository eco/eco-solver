import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { RewardTokensInterface } from '@eco-solver/contracts'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { FulfillmentEstimateService } from '@eco-solver/fulfillment-estimate/fulfillment-estimate.service'
import {
  validationsSucceeded,
  ValidationService,
  TxValidationFn,
} from '@eco-solver/intent/validation.sevice'
import {
  QuoteIntentDataDTO,
  QuoteIntentDataInterface,
} from '@eco-solver/quote/dto/quote.intent.data.dto'
import {
  InfeasibleQuote,
  InsufficientBalance,
  InternalQuoteError,
  InternalSaveError,
  InvalidQuoteIntent,
  Quote400,
  SolverUnsupported,
} from '@eco-solver/quote/errors'
import { QuoteIntentModel } from '@eco-solver/quote/schemas/quote-intent.schema'
import { Mathb } from '@eco-solver/utils/bigint'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import dayjs from 'dayjs'
import { encodeFunctionData, erc20Abi, formatEther, parseGwei } from "viem"
import { Hex } from "viem"
import { FeeService } from '@eco-solver/fee/fee.service'
import { CalculateTokensType } from '@eco-solver/fee/types'
import { EcoResponse } from '@eco-solver/common/eco-response'
import { GasEstimationsConfig, QuotesConfig } from '@eco-solver/eco-configs/eco-config.types'
import { QuoteDataEntryDTO } from '@eco-solver/quote/dto/quote-data-entry.dto'
import { QuoteDataDTO } from '@eco-solver/quote/dto/quote-data.dto'
import { QuoteRewardTokensDTO } from '@eco-solver/quote/dto/quote.reward.data.dto'
import { QuoteCallDataDTO } from '@eco-solver/quote/dto/quote.route.data.dto'
import { IntentExecutionType } from '@eco-solver/quote/enums/intent-execution-type.enum'
import { QuoteRepository } from '@eco-solver/quote/quote.repository'
import { TransactionTargetData } from '@eco-solver/intent/utils-intent.service'
import { UpdateQuoteParams } from '@eco-solver/quote/interfaces/update-quote-params.interface'
import { IntentInitiationService } from '@eco-solver/intent-initiation/services/intent-initiation.service'
import { GaslessIntentRequestDTO } from '@eco-solver/quote/dto/gasless-intent-request.dto'
import { ModuleRef } from '@nestjs/core'
import { isInsufficient } from '../fee/utils'
import { serialize } from '@eco-solver/common/utils/serialize'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { ANALYTICS_EVENTS } from '@eco-solver/analytics/events.constants'
import { EcoError } from '@eco-solver/common/errors/eco-error'

const ZERO_SALT = '0x0000000000000000000000000000000000000000000000000000000000000000'

type QuoteFeasibilityCheckFn = (quote: QuoteIntentDataInterface) => Promise<{ error?: Error }>
interface GenerateQuoteParams {
  quoteIntent: QuoteIntentDataInterface
  intentExecutionType: IntentExecutionType
  isReverseQuote: boolean
  gaslessIntentRequest: GaslessIntentRequestDTO
}

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnModuleInit {
  private logger = new Logger(QuoteService.name)

  private quotesConfig: QuotesConfig
  private gasEstimationsConfig: GasEstimationsConfig
  private intentInitiationService: IntentInitiationService

  constructor(
    private readonly quoteRepository: QuoteRepository,
    private readonly feeService: FeeService,
    private readonly validationService: ValidationService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly fulfillmentEstimateService: FulfillmentEstimateService,
    private readonly moduleRef: ModuleRef,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  onModuleInit() {
    this.quotesConfig = this.ecoConfigService.getQuotesConfig()
    this.gasEstimationsConfig = this.ecoConfigService.getGasEstimationsConfig()
    this.intentInitiationService = this.moduleRef.get(IntentInitiationService, {
      strict: false,
    })
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

    const txValidationFn: TxValidationFn = () => true
    const quoteFeasibilityCheckFn: QuoteFeasibilityCheckFn = this.feeService.isRouteFeasible.bind(
      this.feeService,
    )

    return this._getQuote(quoteIntentDataDTO, txValidationFn, quoteFeasibilityCheckFn, false)
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

    const txValidationFn: TxValidationFn = (tx: TransactionTargetData) =>
      tx && tx.decodedFunctionData.functionName === 'transfer'
    const quoteFeasibilityCheckFn: QuoteFeasibilityCheckFn = this.feeService.isRewardFeasible.bind(
      this.feeService,
    )

    return this._getQuote(quoteIntentDataDTO, txValidationFn, quoteFeasibilityCheckFn, true)
  }

  private async _getQuote(
    quoteIntentDataDTO: QuoteIntentDataDTO,
    txValidationFn: TxValidationFn,
    quoteFeasibilityCheckFn: QuoteFeasibilityCheckFn,
    isReverseQuote: boolean,
  ): Promise<EcoResponse<QuoteDataDTO>> {
    const startTime = Date.now()

    // Track quote processing start
    this.ecoAnalytics.trackQuoteProcessingStarted(quoteIntentDataDTO, isReverseQuote)

    const { response: quoteIntents, error: saveError } = await this.storeQuoteIntentData(
      quoteIntentDataDTO,
    )

    if (saveError) {
      // Track storage error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.QUOTE.STORAGE_FAILED, saveError, {
        quoteID: quoteIntentDataDTO.quoteID,
        dAppID: quoteIntentDataDTO.dAppID,
        processingTimeMs: Date.now() - startTime,
      })
      return { error: InternalSaveError(saveError) }
    }

    // Track successful storage
    this.ecoAnalytics.trackQuoteStorageSuccess(quoteIntentDataDTO, quoteIntents!)

    const errors: any[] = []

    const quoteDataDTO: QuoteDataDTO = {
      quoteEntries: [],
    }

    for (const quoteIntent of quoteIntents!) {
      const validationStartTime = Date.now()

      // Track validation start
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.QUOTE.VALIDATION_STARTED, {
        quoteID: quoteIntentDataDTO.quoteID,
        dAppID: quoteIntentDataDTO.dAppID,
        intentExecutionType: quoteIntent.intentExecutionType,
        isReverseQuote,
      })

      const error = await this.validateQuoteIntentData(
        quoteIntent,
        txValidationFn,
        quoteFeasibilityCheckFn,
      )

      if (error) {
        errors.push(error)

        // Track validation failure
        this.ecoAnalytics.trackError(ANALYTICS_EVENTS.QUOTE.VALIDATION_FAILED, error, {
          quoteID: quoteIntentDataDTO.quoteID,
          dAppID: quoteIntentDataDTO.dAppID,
          intentExecutionType: quoteIntent.intentExecutionType,
          isReverseQuote,
          validationTimeMs: Date.now() - validationStartTime,
        })
        continue
      }

      // Track successful validation
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.QUOTE.VALIDATION_SUCCESS, {
        quoteID: quoteIntentDataDTO.quoteID,
        dAppID: quoteIntentDataDTO.dAppID,
        intentExecutionType: quoteIntent.intentExecutionType,
        isReverseQuote,
        validationTimeMs: Date.now() - validationStartTime,
      })

      const generationStartTime = Date.now()

      // Track generation start
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.QUOTE.GENERATION_STARTED, {
        quoteID: quoteIntentDataDTO.quoteID,
        dAppID: quoteIntentDataDTO.dAppID,
        intentExecutionType: quoteIntent.intentExecutionType,
        isReverseQuote,
      })

      const { response: quoteDataEntry, error: quoteError } =
        await this.generateQuoteForIntentExecutionType({
          quoteIntent,
          intentExecutionType: IntentExecutionType.fromString(quoteIntent.intentExecutionType)!,
          isReverseQuote,
          gaslessIntentRequest: this.getGaslessIntentRequest(quoteIntentDataDTO),
        })

      if (quoteError) {
        errors.push(quoteError)
        await this.updateQuoteDb(quoteIntent, { error: quoteError })

        // Track generation failure
        this.ecoAnalytics.trackError(ANALYTICS_EVENTS.QUOTE.GENERATION_FAILED, quoteError, {
          quoteID: quoteIntentDataDTO.quoteID,
          dAppID: quoteIntentDataDTO.dAppID,
          intentExecutionType: quoteIntent.intentExecutionType,
          isReverseQuote,
          generationTimeMs: Date.now() - generationStartTime,
        })
        continue
      }

      quoteDataDTO.quoteEntries.push(quoteDataEntry!)
      await this.updateQuoteDb(quoteIntent, { quoteDataEntry })

      // Track successful generation
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.QUOTE.GENERATION_SUCCESS, {
        quoteID: quoteIntentDataDTO.quoteID,
        dAppID: quoteIntentDataDTO.dAppID,
        intentExecutionType: quoteIntent.intentExecutionType,
        isReverseQuote,
        generationTimeMs: Date.now() - generationStartTime,
      })
    }

    const totalProcessingTime = Date.now() - startTime

    if (quoteDataDTO.quoteEntries.length === 0) {
      // Track complete failure
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.QUOTE.PROCESSING_FAILED_ALL,
        new Error('All quotes failed'),
        {
          quoteID: quoteIntentDataDTO.quoteID,
          dAppID: quoteIntentDataDTO.dAppID,
          isReverseQuote,
          totalErrors: errors.length,
          errorCount: errors.length,
          processingTimeMs: totalProcessingTime,
        },
      )
      return { error: errors }
    }

    // Track successful completion
    this.ecoAnalytics.trackQuoteProcessingSuccess(
      quoteIntentDataDTO,
      isReverseQuote,
      quoteDataDTO.quoteEntries.length,
      errors.length,
      totalProcessingTime,
      quoteDataDTO.quoteEntries.map((q) => q.intentExecutionType),
    )

    return { response: quoteDataDTO }
  }

  private getGaslessIntentRequest(quoteIntentDataDTO: QuoteIntentDataDTO): GaslessIntentRequestDTO {
    return {
      quoteID: quoteIntentDataDTO.quoteID,
      dAppID: quoteIntentDataDTO.dAppID,
      salt: ZERO_SALT,
      route: quoteIntentDataDTO.route,
      reward: quoteIntentDataDTO.reward,
      gaslessIntentData: quoteIntentDataDTO.gaslessIntentData!,
    }
  }

  /**
   * Stores the quote into the db
   * @param quoteIntentDataDTO the quote intent data
   * @returns the stored record or an error
   */
  async storeQuoteIntentData(
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): Promise<EcoResponse<QuoteIntentModel[]>> {
    return this.quoteRepository.storeQuoteIntentData(quoteIntentDataDTO)
  }

  /**
   * Fetch a quote from the db
   * @param query the quote intent data
   * @returns the quote or an error
   */
  async fetchQuoteIntentData(query: object): Promise<EcoResponse<QuoteIntentModel>> {
    return this.quoteRepository.fetchQuoteIntentData(query)
  }

  /**
   * Fetch a quote from the db
   * @param query the quote intent data
   * @returns the quote or an error
   */
  async quoteExists(query: object): Promise<boolean> {
    return this.quoteRepository.quoteExists(query)
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
    txValidationFn: TxValidationFn = () => true,
    quoteFeasibilityCheckFn: QuoteFeasibilityCheckFn = this.feeService.isRouteFeasible.bind(
      this.feeService,
    ),
  ): Promise<Quote400 | undefined> {
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

    const validations = await this.validationService.assertValidations(
      quoteIntentModel,
      solver,
      txValidationFn,
    )

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
      await this.updateQuoteDb(quoteIntentModel, {
        error: InvalidQuoteIntent(validations),
      })
      return InvalidQuoteIntent(validations)
    }

    const { error } = await quoteFeasibilityCheckFn(quoteIntentModel)

    if (error) {
      const quoteError = InfeasibleQuote(error)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: quote intent is not feasable ${quoteIntentModel._id}`,
          properties: {
            quoteIntentModel,
            feasable: false,
            error: quoteError,
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
    isReverseQuote = false,
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
    params: GenerateQuoteParams,
  ): Promise<EcoResponse<QuoteDataEntryDTO>> {
    const { intentExecutionType } = params

    switch (true) {
      case intentExecutionType.isSelfPublish():
        return this.generateQuoteForSelfPublish(params)

      case intentExecutionType.isGasless():
        return this.generateQuoteForGasless(params)

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
    params: GenerateQuoteParams,
  ): Promise<EcoResponse<QuoteDataEntryDTO>> {
    const { quoteIntent, isReverseQuote } = params

    const { response: quoteDataEntry, error } = await this.generateBaseQuote(
      quoteIntent,
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
    params: GenerateQuoteParams,
  ): Promise<EcoResponse<QuoteDataEntryDTO>> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `generateQuoteForGasless`,
        properties: {
          params,
        },
      }),
    )

    const { quoteIntent, isReverseQuote } = params
    const gaslessIntentRequest = GaslessIntentRequestDTO.fromJSON(params.gaslessIntentRequest)

    const { response: quoteDataEntry, error } = await this.generateBaseQuote(
      quoteIntent,
      isReverseQuote,
    )

    if (error) {
      return { error }
    }

    quoteDataEntry!.intentExecutionType = IntentExecutionType.GASLESS.toString()

    // todo: figure out what extra fee should be added to the base quote to cover our gas costs for the gasless intent
    // await this.intentInitiationService.calculateGasQuoteForIntent(gaslessIntentRequest)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const flatFee = await this.estimateFlatFee(
      gaslessIntentRequest.getSourceChainID!(),
      quoteDataEntry!,
    )

    return { response: quoteDataEntry }
  }

  async estimateFlatFee(chainID: number, quoteDataEntry: QuoteDataEntryDTO): Promise<bigint> {
    const { rewardTokens } = quoteDataEntry
    const { fundFor, permit2, defaultGasPriceGwei } = this.gasEstimationsConfig

    // Let's assume each token requires a permit2 approval
    const baseGas = fundFor
    const gas = baseGas + BigInt(rewardTokens.length) * permit2

    const defaultGasPrice = parseGwei(defaultGasPriceGwei)
    const gasPrice = await this.intentInitiationService.getGasPrice(chainID, defaultGasPrice)

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `estimateFlatFee`,
        properties: {
          chainID,
          baseGas,
          gas,
          gasPrice,
          totalFee: gas * gasPrice,
          'totalFee in ETH': formatEther(gas * gasPrice),
        },
      }),
    )

    return gas * gasPrice
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

    const { srcDeficitDescending: fundable, rewards } = calculated as CalculateTokensType

    const { totalFillNormalized, error: totalFillError } = await this.feeService.getTotalFill(
      quoteIntentModel,
    )
    if (totalFillError) {
      return { error: totalFillError }
    }
    const totalAsk = this.feeService.getAsk(totalFillNormalized, quoteIntentModel)

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Generating quote`,
        properties: serialize({ totalFillNormalized, totalAsk: totalAsk }),
      }),
    )

    const { totalRewardsNormalized, error: totalRewardsError } =
      await this.feeService.getTotalRewards(quoteIntentModel)
    if (totalRewardsError) {
      return { error: totalRewardsError }
    }
    if (isInsufficient(totalAsk, totalRewardsNormalized)) {
      return { error: InsufficientBalance(totalAsk, totalRewardsNormalized) }
    }
    let filled = 0n
    const totalTokenAsk = totalAsk.token
    const quoteRecord: Record<Hex, RewardTokensInterface> = {}
    for (const deficit of fundable) {
      if (filled >= totalTokenAsk) {
        break
      }
      const left = totalTokenAsk - filled
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
    if (filled < totalTokenAsk) {
      for (const deficit of fundable) {
        if (filled >= totalTokenAsk) {
          break
        }
        const left = totalTokenAsk - filled
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

    const estimatedFulfillTimeSec =
      this.fulfillmentEstimateService.getEstimatedFulfillTime(quoteIntentModel)

    const gasOverhead = this.getGasOverhead(quoteIntentModel)

    return {
      response: {
        routeTokens: quoteIntentModel.route.tokens,
        routeCalls: quoteIntentModel.route.calls,
        rewardTokens: Object.values(quoteRecord) as QuoteRewardTokensDTO[],
        rewardNative: totalAsk.native,
        expiryTime: this.getQuoteExpiryTime(),
        estimatedFulfillTimeSec,
        gasOverhead,
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
    const { destDeficitDescending: fundable, tokens, calls } = calculated as CalculateTokensType
    const { totalRewardsNormalized, error: totalRewardsError } =
      await this.feeService.getTotalRewards(intent)
    if (totalRewardsError) {
      return { error: totalRewardsError }
    }
    const fee = this.feeService.getFee(totalRewardsNormalized, intent)

    if (isInsufficient(fee, totalRewardsNormalized)) {
      return { error: InsufficientBalance(fee, totalRewardsNormalized) }
    }

    // Calculate total amount available after fee subtraction
    const totalAvailableAfterFee = totalRewardsNormalized.token - fee.token
    const totalAvailableAfterFeeNative = totalRewardsNormalized.native - fee.native
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
        rewardNative: totalAvailableAfterFeeNative,
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
   * @returns the gas overhead of the quote
   */
  getGasOverhead(quoteIntentModel: QuoteIntentDataInterface): number {
    const defaultGasOverhead = this.getDefaultGasOverhead()
    const solver = this.ecoConfigService.getSolver(quoteIntentModel.route.source)

    if (solver?.gasOverhead == null) {
      return defaultGasOverhead
    }

    if (solver.gasOverhead < 0) {
      this.logger.warn(
        EcoLogMessage.withError({
          message: `Invalid negative gasOverhead: ${solver.gasOverhead}, using default gas overhead`,
          error: EcoError.NegativeGasOverhead(solver.gasOverhead),
        }),
      )
      return defaultGasOverhead
    }

    return solver.gasOverhead
  }

  /**
   * @returns the default gas overhead
   */
  private getDefaultGasOverhead(): number {
    const intentConfigs = this.ecoConfigService.getIntentConfigs()
    if (intentConfigs.defaultGasOverhead == null) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'intentConfigs.defaultGasOverhead is undefined',
          error: EcoError.DefaultGasOverheadUndefined(),
        }),
      )
      throw EcoError.DefaultGasOverheadUndefined()
    }

    return intentConfigs.defaultGasOverhead
  }

  /**
   * Updates the quote intent model in the db
   * @param quoteIntentModel the model to update
   * @returns
   */
  async updateQuoteDb(
    quoteIntentModel: QuoteIntentModel,
    updateQuoteParams: UpdateQuoteParams,
  ): Promise<EcoResponse<QuoteIntentModel>> {
    return this.quoteRepository.updateQuoteDb(quoteIntentModel, updateQuoteParams)
  }
}
