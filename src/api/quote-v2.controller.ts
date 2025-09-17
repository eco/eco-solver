import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { API_V2_ROOT } from '@/common/routes/constants'
import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common'
import { EcoAnalyticsService } from '@/analytics'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { jsonBigInt } from '@/commander/utils'
import { QuoteErrorsInterface } from '@/quote/errors'
import { QuoteV2RequestDTO } from '@/quote/dto/v2/quote-v2-request.dto'
import { QuoteV2ResponseDTO } from '@/quote/dto/v2/quote-v2-response.dto'
import { QuoteV2Service } from '@/quote/quote-v2.service'

@Controller(API_V2_ROOT + '/quote')
export class QuoteV2Controller {
  private logger = new EcoLogger(QuoteV2Controller.name)

  constructor(
    private readonly quoteV2Service: QuoteV2Service,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  @Post()
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

    // Get reverse quote using existing service (V2 uses reverse quote logic)
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

    // Track successful V2 response
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.QUOTE.V2_RESPONSE_SUCCESS, {
      dAppID: v2Request.dAppID,
      processingTimeMs: processingTime,
      sourceChainID: v2Response!.quoteResponse.sourceChainID,
      destinationChainID: v2Response!.quoteResponse.destinationChainID,
    })

    return v2Response!
  }

  @Post('/reverse')
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

    // Track successful V2 response
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.QUOTE.V2_RESPONSE_SUCCESS, {
      dAppID: v2Request.dAppID,
      processingTimeMs: processingTime,
      sourceChainID: v2Response!.quoteResponse.sourceChainID,
      destinationChainID: v2Response!.quoteResponse.destinationChainID,
    })

    return v2Response!
  }
}
