import { API_ROOT, QUOTE_ROUTE } from '@/common/routes/constants'
import { BigIntToStringInterceptor } from '@/interceptors/big-int.interceptor'
import { Body, Controller, InternalServerErrorException, Logger, Post } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteErrorsInterface } from '@/quote/errors'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteService } from '@/quote/quote.service'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

@ApiTags('Quote V1')
@Controller(API_ROOT + QUOTE_ROUTE)
export class QuoteController {
  private logger = new Logger(QuoteController.name)

  constructor(
    private readonly quoteService: QuoteService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Get quote',
    description:
      'Given desired destination operations and amounts, calculate and return the required source token amounts. Returns multiple quote entries, one for each requested execution type (e.g., SELF_PUBLISH, GASLESS), including fees and execution estimates.',
  })
  @ApiBody({ type: QuoteIntentDataDTO })
  @ApiResponse({
    status: 200,
    description: 'Quote successfully generated',
    type: QuoteDataDTO,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request parameters - check route configuration, token addresses, and amounts',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - authentication required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - quote generation failed',
  })
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
  @ApiOperation({
    summary: 'Get reverse quote',
    description:
      'Given the source token amount, calculate and return the destination amounts after subtracting fees. Returns multiple quote entries for each requested execution type.',
  })
  @ApiBody({ type: QuoteIntentDataDTO })
  @ApiResponse({
    status: 200,
    description: 'Reverse quote successfully generated',
    type: QuoteDataDTO,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request parameters - check route configuration, token addresses, and amounts',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - authentication required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - reverse quote generation failed',
  })
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
      error: {
        message: error.message || JSON.stringify(BigIntToStringInterceptor.transformBigInt(error)),
      },
    })
  }
}
