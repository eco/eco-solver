import { API_ROOT, QUOTE_ROUTE } from '@/common/routes/constants'
import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common'
import { QuoteGenerationLogger } from '@/common/logging/loggers'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteErrorsInterface } from '@/quote/errors'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteService } from '@/quote/quote.service'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

@Controller(API_ROOT + QUOTE_ROUTE)
export class QuoteController {
  private logger = new QuoteGenerationLogger('QuoteController')

  constructor(
    private readonly quoteService: QuoteService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  @Post()
  async getQuote(@Body() quoteIntentDataDTO: QuoteIntentDataDTO): Promise<QuoteDataDTO> {
    const startTime = Date.now()

    this.logger.log(
      {
        quoteId: quoteIntentDataDTO.quoteID,
        dAppId: quoteIntentDataDTO.dAppID,
        sourceChainId: Number(quoteIntentDataDTO.route.source),
        destinationChainId: Number(quoteIntentDataDTO.route.destination),
        intentExecutionType: quoteIntentDataDTO.intentExecutionTypes.join(','),
        operationType: 'quote_generation',
        status: 'started',
      },
      'Received quote request',
      { quoteIntentDataDTO },
    )

    // Track quote request start
    this.ecoAnalytics.trackQuoteRequestReceived(quoteIntentDataDTO)

    const { response: quote, error } = await this.quoteService.getQuote(quoteIntentDataDTO)
    const processingTime = Date.now() - startTime

    this.logger.log(
      {
        quoteId: quoteIntentDataDTO.quoteID,
        dAppId: quoteIntentDataDTO.dAppID,
        sourceChainId: Number(quoteIntentDataDTO.route.source),
        destinationChainId: Number(quoteIntentDataDTO.route.destination),
        intentExecutionType: quoteIntentDataDTO.intentExecutionTypes.join(','),
        operationType: 'quote_generation',
        status: error ? 'failed' : 'completed',
      },
      'Responding to quote request',
      {
        quote,
        error,
        processingTimeMs: processingTime,
      },
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
      {
        quoteId: quoteIntentDataDTO.quoteID,
        dAppId: quoteIntentDataDTO.dAppID,
        sourceChainId: Number(quoteIntentDataDTO.route.source),
        destinationChainId: Number(quoteIntentDataDTO.route.destination),
        intentExecutionType: quoteIntentDataDTO.intentExecutionTypes.join(','),
        operationType: 'quote_generation',
        status: 'started',
      },
      'Received reverse quote request',
      { quoteIntentDataDTO },
    )

    // Track reverse quote request start
    this.ecoAnalytics.trackReverseQuoteRequestReceived(quoteIntentDataDTO)

    const { response: quote, error } = await this.quoteService.getReverseQuote(quoteIntentDataDTO)
    const processingTime = Date.now() - startTime

    this.logger.log(
      {
        quoteId: quoteIntentDataDTO.quoteID,
        dAppId: quoteIntentDataDTO.dAppID,
        sourceChainId: Number(quoteIntentDataDTO.route.source),
        destinationChainId: Number(quoteIntentDataDTO.route.destination),
        intentExecutionType: quoteIntentDataDTO.intentExecutionTypes.join(','),
        operationType: 'quote_generation',
        status: error ? 'failed' : 'completed',
      },
      'Responding to reverse quote request',
      {
        quote,
        error,
        processingTimeMs: processingTime,
      },
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
