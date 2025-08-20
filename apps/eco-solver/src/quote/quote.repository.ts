import { EcoConfigService } from '@libs/config-core'
import { EcoError } from '@eco-solver/common/errors/eco-error'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { EcoResponse } from '@eco-solver/common/eco-response'
import { FilterQuery, Model, Types, UpdateQuery } from 'mongoose'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { QuoteIntentDataDTO } from '@eco-solver/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@eco-solver/quote/schemas/quote-intent.schema'
import { QuoteRouteDataModel } from '@eco-solver/quote/schemas/quote-route.schema'
import { QuotesConfig } from '@libs/config-core'
import { UpdateQuoteParams } from '@eco-solver/quote/interfaces/update-quote-params.interface'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { ANALYTICS_EVENTS } from '@eco-solver/analytics/events.constants'

type QuoteQuery = FilterQuery<QuoteIntentModel>
type QuoteUpdate = UpdateQuery<QuoteIntentModel>

/**
 * QuoteRepository is responsible for interacting with the database to store and fetch quote intent data.
 */
@Injectable()
export class QuoteRepository {
  private logger = new Logger(QuoteRepository.name)
  private quotesConfig: QuotesConfig

  constructor(
    @InjectModel(QuoteIntentModel.name) private quoteIntentModel: Model<QuoteIntentModel>,
    private readonly ecoConfigService: EcoConfigService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  onModuleInit() {
    this.quotesConfig = this.ecoConfigService.getQuotesConfig()
  }

  /**
   * Stores the quote into the db
   * @param quoteIntentDataDTO the quote intent data
   * @returns the stored record or an error
   */
  async storeQuoteIntentData(
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): Promise<EcoResponse<QuoteIntentModel[]>> {
    const validationResult = this.validateQuoteIntentData(quoteIntentDataDTO)

    if (!validationResult.isValid) {
      return { error: new Error(`Validation failed: ${validationResult.errors.join(', ')}`) }
    }

    const supportedIntentExecutionTypes = this.getSupportedIntentExecutionTypes()
    const errors: any[] = []
    const quoteIntentModels: QuoteIntentModel[] = []

    for (const intentExecutionType of quoteIntentDataDTO.intentExecutionTypes) {
      // Check if the intent execution type is valid
      if (!supportedIntentExecutionTypes.includes(intentExecutionType)) {
        continue
      }

      const quoteIntentModel = this.createQuoteModelData(intentExecutionType, quoteIntentDataDTO)
      const { response: dbQuoteIntentModel, error } =
        await this.storeQuoteIntentDataForExecutionType(quoteIntentModel)

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `storeQuoteIntentData: error storing quote for: ${intentExecutionType}`,
            properties: {
              quoteID: quoteIntentDataDTO.quoteID,
              dAppID: quoteIntentDataDTO.dAppID,
              intentExecutionType,
              error,
            },
          }),
        )

        // Track database error
        this.ecoAnalytics.trackError(ANALYTICS_EVENTS.QUOTE.DATABASE_STORE_ERROR, error, {
          quoteIntentDataDTO,
          intentExecutionType,
          quoteIntentModel,
        })

        errors.push(error)
        continue
      }

      quoteIntentModel._id = dbQuoteIntentModel!._id
      quoteIntentModels.push(quoteIntentModel)
    }

    if (quoteIntentModels.length === 0) {
      return { error: errors }
    }

    return { response: quoteIntentModels }
  }

  /**
   * Stores a single quote model into the database
   * @param quoteModelData the quote model data to store
   * @returns the stored record or an error
   */
  private async storeQuoteIntentDataForExecutionType(
    quoteModelData: QuoteIntentModel,
  ): Promise<EcoResponse<QuoteIntentModel>> {
    try {
      quoteModelData = {
        ...quoteModelData,
        route: {
          ...quoteModelData.route,
        },
        reward: {
          ...quoteModelData.reward,
        },
      }

      const record = await this.quoteIntentModel.create(quoteModelData)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `storeQuoteIntentDataForExecutionType: Recorded quote intent`,
          properties: {
            quoteID: quoteModelData.quoteID,
            dAppID: quoteModelData.dAppID,
            intentExecutionType: quoteModelData.intentExecutionType,
            recordId: record._id,
          },
        }),
      )
      return { response: record }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `storeQuoteIntentDataForExecutionType: error storing quote intent`,
          properties: {
            quoteID: quoteModelData.quoteID,
            dAppID: quoteModelData.dAppID,
            intentExecutionType: quoteModelData.intentExecutionType,
            error: ex.message,
          },
        }),
      )
      return { error: ex }
    }
  }

  /**
   * Creates a quote model data object from DTO
   * @param intentExecutionType the intent execution type
   * @param quoteIntentDataDTO the quote intent data DTO
   * @returns the quote model data
   */

  private createQuoteModelData(
    intentExecutionType: string,
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): QuoteIntentModel {
    const { quoteID, dAppID, route: quoteRoute, reward } = quoteIntentDataDTO

    return {
      _id: new Types.ObjectId(),
      quoteID,
      dAppID,
      intentExecutionType,
      route: quoteRoute,
      reward,
      receipt: null,
    }
  }

  /**
   * Fetch a quote from the db
   * @param query the quote query filter
   * @returns the quote or an error
   */
  async fetchQuoteIntentData(query: QuoteQuery): Promise<EcoResponse<QuoteIntentModel>> {
    try {
      const quoteIntentData = await this.quoteIntentModel.findOne(query).lean()

      if (!quoteIntentData) {
        return { error: EcoError.QuoteNotFound }
      }

      return { response: quoteIntentData }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `fetchQuoteIntentData: Error fetching quote intent data`,
          properties: {
            query,
            error: ex.message,
          },
        }),
      )
      return { error: ex }
    }
  }

  /**
   * Checks if a quote exists in the db
   * @param query the quote query filter
   * @returns true if the quote exists, false otherwise
   */
  async quoteExists(query: QuoteQuery): Promise<boolean> {
    try {
      const count = await this.quoteIntentModel.countDocuments(query)
      return count > 0
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error checking quote existence`,
          properties: {
            query,
            error: ex.message,
          },
        }),
      )
      return false
    }
  }

  /**
   * Updates the quote intent model in the db
   * @param quoteIntentModel the model to update
   * @param updateQuoteParams the update parameters
   * @returns the updated model or an error
   */
  async updateQuoteDb(
    quoteIntentModel: QuoteIntentModel,
    updateQuoteParams: UpdateQuoteParams,
  ): Promise<EcoResponse<QuoteIntentModel>> {
    try {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `updateQuoteDb`,
          properties: {
            quoteId: quoteIntentModel._id,
            hasError: Boolean(updateQuoteParams.error),
            hasQuoteDataEntry: Boolean(updateQuoteParams.quoteDataEntry),
          },
        }),
      )

      const updateQuery = this.buildUpdateQuery(quoteIntentModel, updateQuoteParams)
      const filter: QuoteQuery = { _id: quoteIntentModel._id }

      const updatedModel = await this.quoteIntentModel.findOneAndUpdate(filter, updateQuery, {
        upsert: false,
        new: true,
        lean: true,
      })

      if (!updatedModel) {
        return { error: EcoError.QuoteNotFound }
      }

      return { response: updatedModel }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error updating quote in database`,
          properties: {
            quoteID: quoteIntentModel.quoteID,
            error: ex.message,
          },
        }),
      )
      return { error: EcoError.QuoteDBUpdateError }
    }
  }

  /**
   * Validates quote intent data
   * @param quoteIntentDataDTO the quote intent data to validate
   * @returns validation result
   */
  private validateQuoteIntentData(quoteIntentDataDTO: QuoteIntentDataDTO): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!quoteIntentDataDTO.quoteID?.trim()) {
      errors.push('quoteID is required')
    }

    if (!quoteIntentDataDTO.dAppID?.trim()) {
      errors.push('dAppID is required')
    }

    if (
      !Array.isArray(quoteIntentDataDTO.intentExecutionTypes) ||
      quoteIntentDataDTO.intentExecutionTypes.length === 0
    ) {
      errors.push('intentExecutionTypes must be a non-empty array')
    }

    if (!quoteIntentDataDTO.route) {
      errors.push('route is required')
    }

    if (!quoteIntentDataDTO.reward) {
      errors.push('reward is required')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Gets supported intent execution types from config
   * @returns array of supported types
   */
  private getSupportedIntentExecutionTypes(): string[] {
    return (this.quotesConfig?.intentExecutionTypes as string[]) || []
  }

  /**
   * Builds update query for quote model
   * @param quoteIntentModel the original model
   * @param updateQuoteParams the update parameters
   * @returns the update query
   */
  private buildUpdateQuery(
    quoteIntentModel: QuoteIntentModel,
    updateQuoteParams: UpdateQuoteParams,
  ): QuoteUpdate {
    const { error, quoteDataEntry } = updateQuoteParams

    if (error) {
      return { $set: { receipt: { error } } }
    }

    if (!quoteDataEntry) {
      throw new Error('Either error or quoteDataEntry must be provided')
    }

    const { routeTokens, routeCalls, rewardTokens, rewardNative } = quoteDataEntry

    const updatedRoute: QuoteRouteDataModel = {
      ...quoteIntentModel.route,
      tokens: routeTokens,
      calls: routeCalls,
    }

    return {
      $set: {
        receipt: { quoteDataEntry },
        route: updatedRoute,
        'reward.tokens': rewardTokens,
        'reward.nativeValue': rewardNative || BigInt(0),
      },
    }
  }
}
