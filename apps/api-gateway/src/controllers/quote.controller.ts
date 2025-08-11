import { Controller, Post, Body, Logger, InternalServerErrorException } from '@nestjs/common'
import { API_ROOT, QUOTE_ROUTE } from '@libs/shared'
import { EcoLogMessage } from '@libs/shared'
import { QuoteService, QuoteIntentDataDTO, QuoteDataDTO, QuoteErrorsInterface } from '@libs/domain'
import { EcoAnalyticsService } from '@libs/integrations'
import { ANALYTICS_EVENTS } from '@libs/integrations'
import { getEcoServiceException } from '@libs/shared'

@Controller(API_ROOT + QUOTE_ROUTE)
export class QuoteController {
  private logger = new Logger(QuoteController.name)

  constructor(
    private readonly quoteService: QuoteService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  @Post()
  async getQuote(@Body() quoteIntentDataDTO: QuoteIntentDataDTO): Promise<QuoteDataDTO> {
    const startTime = Date.now()

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received quote request:`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )

    // Track quote request start
    this.ecoAnalytics.trackQuoteRequestReceived(quoteIntentDataDTO)

    const { response: quote, error } = await this.quoteService.getQuote(quoteIntentDataDTO)
    const processingTime = Date.now() - startTime

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
      // Track successful quote response
      this.ecoAnalytics.trackQuoteResponseSuccess(quoteIntentDataDTO, processingTime, quote!)
      return quote!
    }

    const errorStatus = (error as QuoteErrorsInterface).statusCode

    // Track quote error
    this.ecoAnalytics.trackQuoteResponseError(
      quoteIntentDataDTO,
      processingTime,
      error,
      errorStatus,
    )

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
    const startTime = Date.now()

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received reverse quote request:`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )

    // Track reverse quote request start
    this.ecoAnalytics.trackReverseQuoteRequestReceived(quoteIntentDataDTO)

    const { response: quote, error } = await this.quoteService.getReverseQuote(quoteIntentDataDTO)
    const processingTime = Date.now() - startTime

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
      // Track successful reverse quote response
      this.ecoAnalytics.trackReverseQuoteResponseSuccess(quoteIntentDataDTO, processingTime, quote!)
      return quote!
    }

    const errorStatus = (error as QuoteErrorsInterface).statusCode

    // Track reverse quote error
    this.ecoAnalytics.trackError(ANALYTICS_EVENTS.QUOTE.REVERSE_RESPONSE_ERROR, error, {
      quoteIntentDataDTO,
      processingTimeMs: processingTime,
      statusCode: errorStatus || 500,
      timestamp: new Date().toISOString(),
    })

    if (errorStatus) {
      throw getEcoServiceException({ error })
    }

    // Also throw a generic InternalServerErrorException if error has no statusCode
    throw getEcoServiceException({
      httpExceptionClass: InternalServerErrorException,
      error: { message: error.message || JSON.stringify(error) },
    })
  }
}
