import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { API_V2_ROOT } from '@/common/routes/constants'
import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger'
import { EcoAnalyticsService } from '@/analytics'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { jsonBigInt } from '@/commander/utils'
import { QuoteErrorsInterface } from '@/quote/errors'
import { QuoteV2RequestDTO } from '@/quote/dto/v2/quote-v2-request.dto'
import { QuoteV2ResponseDTO } from '@/quote/dto/v2/quote-v2-response.dto'
import { QuoteV2Service } from '@/quote/quote-v2.service'

@ApiTags('Quote V2')
@Controller(API_V2_ROOT + '/quote')
export class QuoteV2Controller {
  private logger = new EcoLogger(QuoteV2Controller.name)

  constructor(
    private readonly quoteV2Service: QuoteV2Service,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Get quote (V2)',
    description:
      'Given the desired destination token and amount, calculate and return the required source token amount. Returns quotes with detailed fee breakdowns and contract addresses needed for execution.',
  })
  @ApiBody({ type: QuoteV2RequestDTO })
  @ApiResponse({
    status: 200,
    description: 'Quote successfully generated with detailed fee breakdown',
    type: QuoteV2ResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters - check chain IDs, token addresses, and amount',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - authentication required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - quote generation failed',
  })
  async getQuote(@Body() v2Request: QuoteV2RequestDTO): Promise<QuoteV2ResponseDTO> {
    const startTime = Date.now()

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received V2 quote request`,
        properties: {
          v2Request,
        },
      }),
    )

    const { response: v2Response, error } = await this.quoteV2Service.getQuote(v2Request)
    const processingTime = Date.now() - startTime

    if (error) {
      // Handle errors from quote service
      const errorStatus = (error as QuoteErrorsInterface).statusCode

      // Track V2 quote error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.QUOTE.V2_RESPONSE_ERROR, error, {
        dAppID: v2Request.dAppID,
        processingTimeMs: processingTime,
        statusCode: errorStatus || 500,
      })

      if (errorStatus) {
        throw getEcoServiceException({ error })
      }

      // Throw generic error if no status code
      throw getEcoServiceException({
        httpExceptionClass: InternalServerErrorException,
        error: { message: error.message || jsonBigInt(error) },
      })
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Responding to V2 quote request:`,
        properties: {
          v2Response,
        },
      }),
    )

    return v2Response!
  }

  @Post('/reverse')
  @ApiOperation({
    summary: 'Get reverse quote (V2)',
    description:
      'Given the source token amount, calculate and return the destination token amounts after subtracting fees.',
  })
  @ApiBody({ type: QuoteV2RequestDTO })
  @ApiResponse({
    status: 200,
    description: 'Reverse quote successfully generated with detailed fee breakdown',
    type: QuoteV2ResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters - check chain IDs, token addresses, and amount',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - authentication required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - reverse quote generation failed',
  })
  async getReverseQuote(@Body() v2Request: QuoteV2RequestDTO): Promise<QuoteV2ResponseDTO> {
    const startTime = Date.now()

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received V2 reverse quote request`,
        properties: {
          v2Request,
        },
      }),
    )

    // Get reverse quote using existing service (V2 uses reverse quote logic)
    const { response: v2Response, error } = await this.quoteV2Service.getReverseQuote(v2Request)
    const processingTime = Date.now() - startTime

    if (error) {
      // Handle errors from quote service
      const errorStatus = (error as QuoteErrorsInterface).statusCode

      // Track V2 quote error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.QUOTE.V2_RESPONSE_ERROR, error, {
        dAppID: v2Request.dAppID,
        processingTimeMs: processingTime,
        statusCode: errorStatus || 500,
      })

      if (errorStatus) {
        throw getEcoServiceException({ error })
      }

      // Throw generic error if no status code
      throw getEcoServiceException({
        httpExceptionClass: InternalServerErrorException,
        error: { message: error.message || jsonBigInt(error) },
      })
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Responding to V2 reverse quote request:`,
        properties: {
          v2Response,
        },
      }),
    )

    return v2Response!
  }
}
