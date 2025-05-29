import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model, UpdateQuery } from 'mongoose'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRouteDataModel } from '@/quote/schemas/quote-route.schema'
import { QuotesConfig } from '@/eco-configs/eco-config.types'
import { UpdateQuoteParams } from '@/quote/interfaces/update-quote-params.interface'

type QuoteQuery = FilterQuery<QuoteIntentModel>
type QuoteUpdate = UpdateQuery<QuoteIntentModel>

interface CreateQuoteResult {
  success: QuoteIntentModel[]
  errors: Error[]
}

interface QuoteModelData {
  quoteID: string
  dAppID: string
  intentExecutionType: string
  route: QuoteRouteDataModel
  reward: any
}

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

    const supportedTypes = this.getSupportedIntentExecutionTypes()
    const result = await this.createQuoteModelsForSupportedTypes(quoteIntentDataDTO, supportedTypes)

    if (result.success.length === 0) {
      return { error: result.errors }
    }

    return { response: result.success }
  }

  /**
   * Stores a single quote model into the database
   * @param quoteModelData the quote model data to store
   * @returns the stored record or an error
   */
  private async storeQuoteIntentDataForExecutionType(
    quoteModelData: QuoteModelData,
  ): Promise<EcoResponse<QuoteIntentModel>> {
    try {
      const record = await this.quoteIntentModel.create(quoteModelData)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Recorded quote intent`,
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
          message: `Error storing quote intent data`,
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
  ): QuoteModelData {
    return {
      quoteID: quoteIntentDataDTO.quoteID,
      dAppID: quoteIntentDataDTO.dAppID,
      intentExecutionType,
      route: { ...quoteIntentDataDTO.route },
      reward: { ...quoteIntentDataDTO.reward },
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
          message: `Error fetching quote intent data`,
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
            quoteId: quoteIntentModel._id,
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
   * Creates quote models for supported types
   * @param quoteIntentDataDTO the quote intent data
   * @param supportedTypes the supported execution types
   * @returns creation result with success and error arrays
   */
  private async createQuoteModelsForSupportedTypes(
    quoteIntentDataDTO: QuoteIntentDataDTO,
    supportedTypes: string[],
  ): Promise<CreateQuoteResult> {
    const success: QuoteIntentModel[] = []
    const errors: Error[] = []

    for (const intentExecutionType of quoteIntentDataDTO.intentExecutionTypes) {
      if (!supportedTypes.includes(intentExecutionType)) {
        continue
      }

      const quoteModelData = this.createQuoteModelData(intentExecutionType, quoteIntentDataDTO)
      const { response: dbQuoteIntentModel, error } =
        await this.storeQuoteIntentDataForExecutionType(quoteModelData)

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Failed to store quote for execution type: ${intentExecutionType}`,
            properties: {
              quoteID: quoteIntentDataDTO.quoteID,
              dAppID: quoteIntentDataDTO.dAppID,
              intentExecutionType,
              error: error.message,
            },
          }),
        )
        errors.push(error)
        continue
      }

      success.push(dbQuoteIntentModel!)
    }

    return { success, errors }
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
