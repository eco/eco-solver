import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { someFailedValidations, ValidationService } from '@/intent/validation.sevice'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { InvalidQuote, Quote400, SolverUnsupported } from '@/quote/errors'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnApplicationBootstrap {
  private logger = new Logger(QuoteService.name)

  constructor(
    @InjectModel(QuoteIntentModel.name) private quoteIntentModel: Model<QuoteIntentModel>,
    private readonly validationService: ValidationService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  async onApplicationBootstrap() {}

  async getQuote(quoteIntentDataDTO: QuoteIntentDataDTO) {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Getting quote for intent`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )
    // Fire it off, but dont wait for it to store the quote intent data
    this.storeQuoteIntentData(quoteIntentDataDTO)

    const res = await this.validateQuoteIntentData(quoteIntentDataDTO)
    if (res) {
      return res
    }

    return await this.generateQuote(quoteIntentDataDTO)
  }

  async storeQuoteIntentData(quoteIntentDataDTO: QuoteIntentDataDTO): Promise<void> {
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
    }
  }

  async validateQuoteIntentData(
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): Promise<Quote400 | undefined> {
    const solver = this.ecoConfigService.getSolver(quoteIntentDataDTO.route.destination)
    if (!solver) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: No solver found for destination : ${quoteIntentDataDTO.route.destination}`,
          properties: {
            quoteIntentDataDTO,
          },
        }),
      )
      //todo save to db
      return SolverUnsupported
    }

    const validations = await this.validationService.assertValidations(quoteIntentDataDTO, solver)
    if (someFailedValidations(validations)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateQuoteIntentData: Some validations failed`,
          properties: {
            quoteIntentDataDTO,
            validations,
          },
        }),
      )
      //todo save to db
      return InvalidQuote(validations)
    }

    return
  }

  async generateQuote(quoteIntentDataDTO: QuoteIntentDataDTO) {
    //todo
    //check
  }
}
