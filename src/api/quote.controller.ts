import { API_ROOT, QUOTE_ROUTE } from '@/common/routes/constants'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { serialize } from '@/common/utils/serialize'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteErrorsInterface } from '@/quote/errors'
import { QuoteService } from '@/quote/quote.service'
import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common'

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
