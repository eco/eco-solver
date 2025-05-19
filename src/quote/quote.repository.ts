import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { QuoteRouteDataModel } from '@/quote/schemas/quote-route.schema'
import { QuotesConfig } from '@/eco-configs/eco-config.types'
import { RouteType, hashRoute } from '@eco-foundation/routes-ts'
import { UpdateQuoteParams } from '@/quote/interfaces/update-quote-params.interface'

const ZERO_SALT = '0x0000000000000000000000000000000000000000000000000000000000000000'

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
    const supportedIntentExecutionTypes = this.quotesConfig.intentExecutionTypes as string[]
    const errors: any[] = []
    const quoteIntentModels: QuoteIntentModel[] = []

    for (const intentExecutionType of quoteIntentDataDTO.intentExecutionTypes) {
      // Check if the intent execution type is valid
      if (supportedIntentExecutionTypes.includes(intentExecutionType)) {
        const quoteIntentModel = this.getQuoteIntentModel(intentExecutionType, quoteIntentDataDTO)
        const { response: dbQuoteIntentModel, error } =
          await this.storeQuoteIntentDataForExecutionType(quoteIntentModel)

        if (error) {
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: `storeQuoteIntentData: error storing quote for: ${intentExecutionType}`,
              properties: {
                error,
              },
            }),
          )

          errors.push(error)
          continue
        }

        quoteIntentModel._id = dbQuoteIntentModel!._id
        quoteIntentModels.push(quoteIntentModel)
      }
    }

    if (quoteIntentModels.length === 0) {
      return { error: errors }
    }

    return { response: quoteIntentModels }
  }

  /**
   * Stores the quote into the db
   * @param quoteIntentDataDTO the quote intent data
   * @returns the stored record or an error
   */
  private async storeQuoteIntentDataForExecutionType(
    quoteIntentModel: QuoteIntentModel,
  ): Promise<EcoResponse<QuoteIntentModel>> {
    try {
      const record = await this.quoteIntentModel.create(quoteIntentModel)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Recorded quote intent`,
          properties: {
            quoteIntentModel,
            record,
          },
        }),
      )
      return { response: record }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in storeQuoteIntentData`,
          properties: {
            quoteIntentModel,
            error: ex.message,
          },
        }),
      )
      return { error: ex }
    }
  }

  private getQuoteIntentModel(
    intentExecutionType: string,
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): QuoteIntentModel {
    const { quoteID, dAppID, route: quoteRoute, reward } = quoteIntentDataDTO

    const quoteIntentModel: QuoteIntentModel = {
      _id: new Types.ObjectId(),
      quoteID,
      dAppID,
      intentExecutionType,
      // routeHash: this.getRouteHash(quoteRoute),
      route: quoteRoute,
      reward,
      receipt: null,
    } as QuoteIntentModel

    return quoteIntentModel
  }

  /**
   * Fetch a quote from the db
   * @param query the quote intent data
   * @returns the quote or an error
   */
  async fetchQuoteIntentData(query: object): Promise<EcoResponse<QuoteIntentModel>> {
    const quoteIntentData = await this.quoteIntentModel.findOne(query)

    if (!quoteIntentData) {
      return { error: EcoError.QuoteNotFound }
    }

    return { response: quoteIntentData }
  }

  /**
   * Checks if a quote exists in the db
   * @param query the quote intent data
   * @returns true if the quote exists, false otherwise
   */
  async quoteExists(query: object): Promise<boolean> {
    const quoteIntentData = await this.quoteIntentModel.findOne(query)
    return Boolean(quoteIntentData)
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
    try {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `updateQuoteDb`,
          properties: {
            quoteIntentModel,
            updateQuoteParams,
          },
        }),
      )

      const { error, quoteDataEntry } = updateQuoteParams

      if (error) {
        const updatedModel = await this.quoteIntentModel.findOneAndUpdate(
          { _id: quoteIntentModel._id },
          { $set: { receipt: { error } } },
          { upsert: false, new: true },
        )

        return { response: updatedModel! }
      }

      const { routeTokens, routeCalls, rewardTokens } = quoteDataEntry!

      // Get the updated route
      const updatedRoute: QuoteRouteDataModel = {
        ...quoteIntentModel.route,
        tokens: routeTokens,
        calls: routeCalls,
      }

      // Update the quote intent model in the db
      const updates = {
        receipt: { quoteDataEntry },
        routeHash: this.getRouteHash(updatedRoute),
        'route.tokens': routeTokens,
        'route.calls': routeCalls,
        'reward.tokens': rewardTokens,
      }

      const updatedModel = await this.quoteIntentModel.findOneAndUpdate(
        { _id: quoteIntentModel._id },
        { $set: updates },
        { upsert: false, new: true },
      )

      return { response: updatedModel! }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in updateQuoteDb`,
          properties: {
            quoteIntentModel,
            error: ex.message,
          },
        }),
      )
      return { error: EcoError.QuoteDBUpdateError }
    }
  }

  private getRouteHash(quoteRoute: QuoteRouteDataInterface): string {
    // Hash the route using a bogus zero hash
    const saltedRoute: RouteType = {
      ...quoteRoute,
      salt: ZERO_SALT,
    }

    return hashRoute(saltedRoute)
  }
}
