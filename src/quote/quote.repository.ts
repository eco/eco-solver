import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoResponse } from '@/common/eco-response'
import { FilterQuery, Model, Types, UpdateQuery } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { QuoteGenerationLogger } from '@/common/logging/loggers'
import { InjectModel } from '@nestjs/mongoose'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRouteDataModel } from '@/quote/schemas/quote-route.schema'
import { QuotesConfig } from '@/eco-configs/eco-config.types'
import { UpdateQuoteParams } from '@/quote/interfaces/update-quote-params.interface'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

type QuoteQuery = FilterQuery<QuoteIntentModel>
type QuoteUpdate = UpdateQuery<QuoteIntentModel>

/**
 * QuoteRepository is responsible for interacting with the database to store and fetch quote intent data.
 */
@Injectable()
export class QuoteRepository {
  private logger = new QuoteGenerationLogger('QuoteRepository')
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
          {
            quoteId: quoteIntentDataDTO.quoteID,
            dAppId: quoteIntentDataDTO.dAppID,
            intentExecutionType,
            operationType: 'quote_generation',
            status: 'failed',
          },
          `Error storing quote for: ${intentExecutionType}`,
          error,
          {
            quoteID: quoteIntentDataDTO.quoteID,
            dAppID: quoteIntentDataDTO.dAppID,
            intentExecutionType,
            error,
          },
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
        {
          quoteId: quoteModelData.quoteID,
          dAppId: quoteModelData.dAppID,
          intentExecutionType: quoteModelData.intentExecutionType,
          operationType: 'quote_generation',
          status: 'completed',
        },
        'Recorded quote intent',
        {
          quoteID: quoteModelData.quoteID,
          dAppID: quoteModelData.dAppID,
          intentExecutionType: quoteModelData.intentExecutionType,
          recordId: record._id,
        },
      )
      return { response: record }
    } catch (ex) {
      this.logger.error(
        {
          quoteId: quoteModelData.quoteID,
          dAppId: quoteModelData.dAppID,
          intentExecutionType: quoteModelData.intentExecutionType,
          operationType: 'quote_generation',
          status: 'failed',
        },
        'Error storing quote intent',
        ex,
        {
          quoteID: quoteModelData.quoteID,
          dAppID: quoteModelData.dAppID,
          intentExecutionType: quoteModelData.intentExecutionType,
        },
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
        {
          quoteId: 'unknown',
          operationType: 'quote_validation',
          status: 'failed',
        },
        'Error fetching quote intent data',
        ex,
        { query },
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
        {
          quoteId: 'unknown',
          operationType: 'quote_validation',
          status: 'failed',
        },
        'Error checking quote existence',
        ex,
        { query },
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
        {
          quoteId: quoteIntentModel.quoteID,
          operationType: 'quote_generation',
          status: 'started',
        },
        'Updating quote in database',
        {
          quoteId: quoteIntentModel._id,
          hasError: Boolean(updateQuoteParams.error),
          hasQuoteDataEntry: Boolean(updateQuoteParams.quoteDataEntry),
        },
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
        {
          quoteId: quoteIntentModel.quoteID,
          operationType: 'quote_generation',
          status: 'failed',
        },
        'Error updating quote in database',
        ex,
        {
          quoteID: quoteIntentModel.quoteID,
        },
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
