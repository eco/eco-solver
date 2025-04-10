/* eslint-disable @typescript-eslint/no-unused-vars */
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { RouteType, hashRoute } from '@eco-foundation/routes-ts'
import { QuoteExecutionType, QuotesConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoResponse } from '@/common/eco-response'
import { EcoError } from '@/common/errors/eco-error'

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
  // async storeQuoteIntentData(
  //   quoteIntentDataDTO: QuoteIntentDataDTO,
  // ): Promise<EcoResponse<QuoteIntentModel>> {
  //   const intentExecutionTypes = quoteIntentDataDTO.intentExecutionTypes

  //   for (const intentExecutionType of quoteIntentDataDTO.intentExecutionTypes) {
  //     // Check if the intent execution type is valid
  //     if (intentExecutionTypes.includes(intentExecutionType as QuoteExecutionType)) {
  //       const { error } = await this.storeQuoteIntentDataForExecutionType(quoteIntentDataDTO)

  //       if (error) {
  //         this.logger.error(
  //           EcoLogMessage.fromDefault({
  //             message: `storeQuoteIntentData: error storing quote for: ${intentExecutionType}`,
  //             properties: {
  //               error,
  //             },
  //           }),
  //         )

  //         return { error }
  //       }
  //     }
  //   }
  // }

  /**
   * Stores the quote into the db
   * @param quoteIntentDataDTO the quote intent data
   * @returns the stored record or an error
   */
  async storeQuoteIntentData(
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): Promise<EcoResponse<QuoteIntentModel>> {
    try {
      const { dAppID, route: quoteRoute, reward } = quoteIntentDataDTO

      // Hash the route using a bogus zero hash
      const saltedRoute: RouteType = {
        salt: ZERO_SALT,
        ...quoteRoute,
      }

      const quoteIntentModel: QuoteIntentModel = {
        dAppID,
        routeHash: hashRoute(saltedRoute),
        route: quoteRoute,
        reward,
      } as QuoteIntentModel

      const record = await this.quoteIntentModel.create(quoteIntentModel)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Recorded quote intent`,
          properties: {
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
            quoteIntentDataDTO,
            error: ex.message,
          },
        }),
      )
      return { error: ex }
    }
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
