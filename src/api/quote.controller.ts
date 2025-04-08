import { API_ROOT, QUOTE_ROUTE } from '@/common/routes/constants'
import { Body, Controller, InternalServerErrorException, Logger, Post } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteErrorsInterface } from '@/quote/errors'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteService } from '@/quote/quote.service'

@Controller(API_ROOT + QUOTE_ROUTE)
export class QuoteController {
  private logger = new Logger(QuoteController.name)

  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  async getQuote(@Body() quoteIntentDataDTO: QuoteIntentDataDTO): Promise<QuoteDataDTO> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received quote request:`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )
    const { response: quote, error } = await this.quoteService.getQuote(quoteIntentDataDTO)
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Responding to quote request:`,
        properties: {
          quote,
          error,
        },
      }),
    )

    if (!error) {
      return quote!
    }

    const errorStatus = (error as QuoteErrorsInterface).statusCode

    if (errorStatus) {
      throw getEcoServiceException({ error })
    }

    // Also throw a generic InternalServerErrorException if error has no statusCode
    throw getEcoServiceException({
      httpExceptionClass: InternalServerErrorException,
      error: { message: error.message || JSON.stringify(error) },
    })
  }

  @Post('/reverse')
  async getReverseQuote(@Body() quoteIntentDataDTO: QuoteIntentDataDTO): Promise<QuoteDataDTO> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received reverse quote request:`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )
    const { response: quote, error } = await this.quoteService.getReverseQuote(quoteIntentDataDTO)
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Responding to reverse quote request:`,
        properties: {
          quote,
          error,
        },
      }),
    )

    if (!error) {
      return quote!
    }

    const errorStatus = (error as QuoteErrorsInterface).statusCode

    if (errorStatus) {
      throw getEcoServiceException({ error })
    }

    // Also throw a generic InternalServerErrorException if error has no statusCode
    throw getEcoServiceException({
      httpExceptionClass: InternalServerErrorException,
      error: { message: error.message || JSON.stringify(error) },
    })
  }

  @Post('/reverse')
  async getReverseQuote(@Body() quoteIntentDataDTO: QuoteIntentDataDTO): Promise<QuoteDataDTO> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received reverse quote request:`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )
    const { response: quote, error } = await this.quoteService.getReverseQuote(quoteIntentDataDTO)
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Responding to reverse quote request:`,
        properties: {
          quote,
        },
      }),
    )

    if (error) {
      const errorStatus = (error as QuoteErrorsInterface).statusCode
      if (errorStatus) {
        switch (errorStatus) {
          case 400:
            throw new BadRequestException(serialize(error))
          case 500:
          default:
            throw new InternalServerErrorException(serialize(error))
        }
      }
    }

    return quote!
  }
}
