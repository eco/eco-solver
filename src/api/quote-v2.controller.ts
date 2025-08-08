import { API_V2_ROOT } from '@/common/routes/constants'
import { Body, Controller, InternalServerErrorException, Logger, Post } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { QuoteErrorsInterface } from '@/quote/errors'
import { QuoteV2RequestDTO } from '@/quote/dto/quote-v2-request.dto'
import { QuoteService } from '@/quote/quote.service'
import { QuoteV2TransformService } from '@/quote/services/quote-v2-transform.service'
import { QuoteV2RequestTransformService } from '@/quote/services/quote-v2-request-transform.service'
import { QuoteV2ResponseDTO } from '@/quote/dto/quote-v2-response.dto'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

@Controller(API_V2_ROOT + '/quote')
export class QuoteV2Controller {
  private logger = new Logger(QuoteV2Controller.name)

  constructor(
    private readonly quoteService: QuoteService,
    private readonly quoteV2TransformService: QuoteV2TransformService,
    private readonly quoteV2RequestTransformService: QuoteV2RequestTransformService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  @Post()
  async getQuote(@Body() v2Request: QuoteV2RequestDTO): Promise<QuoteV2ResponseDTO> {
    const startTime = Date.now()

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received V2 quote request (using reverse quote logic):`,
        properties: {
          v2Request,
        },
      }),
    )

    // Transform V2 request to QuoteIntentDataDTO
    let quoteIntentDataDTO
    try {
      quoteIntentDataDTO = this.quoteV2RequestTransformService.transformToQuoteIntent(v2Request)
    } catch (transformError) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error transforming V2 request:`,
          properties: {
            error: transformError.message,
            dAppID: v2Request.dAppID,
          },
        }),
      )
      throw getEcoServiceException({
        httpExceptionClass: InternalServerErrorException,
        error: { message: transformError.message },
      })
    }

    // Track V2 quote request (which uses reverse quote logic)
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.QUOTE.V2_REQUEST_RECEIVED, {
      quoteID: quoteIntentDataDTO.quoteID,
      dAppID: v2Request.dAppID,
      sourceChainID: v2Request.quoteRequest.sourceChainID,
      destinationChainID: v2Request.quoteRequest.destinationChainID,
      sourceToken: v2Request.quoteRequest.sourceToken,
      destinationToken: v2Request.quoteRequest.destinationToken,
      sourceAmount: v2Request.quoteRequest.sourceAmount,
      isReverseLogic: true,
    })

    // Get reverse quote using existing service (V2 uses reverse quote logic)
    const { response: quote, error } = await this.quoteService.getReverseQuote(quoteIntentDataDTO)
    const processingTime = Date.now() - startTime

    if (!error && quote) {
      try {
        // Transform to V2 format
        const v2Response = await this.quoteV2TransformService.transformToV2(
          quote,
          quoteIntentDataDTO,
        )

        if (!v2Response) {
          throw new Error('Failed to transform quote to V2 format')
        }

        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `Responding with V2 quote:`,
            properties: {
              quoteID: quoteIntentDataDTO.quoteID,
              v2Response,
            },
          }),
        )

        // Track successful V2 response
        this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.QUOTE.V2_RESPONSE_SUCCESS, {
          quoteID: quoteIntentDataDTO.quoteID,
          dAppID: v2Request.dAppID,
          processingTimeMs: processingTime,
          sourceChainID: v2Response.quoteResponse.sourceChainID,
          destinationChainID: v2Response.quoteResponse.destinationChainID,
        })

        return v2Response
      } catch (transformError) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Error transforming quote to V2 format:`,
            properties: {
              error: transformError.message,
              quoteID: quoteIntentDataDTO.quoteID,
            },
          }),
        )

        // Track transformation error
        this.ecoAnalytics.trackError(ANALYTICS_EVENTS.QUOTE.V2_TRANSFORM_ERROR, transformError, {
          quoteID: quoteIntentDataDTO.quoteID,
          dAppID: v2Request.dAppID,
          processingTimeMs: processingTime,
        })

        throw getEcoServiceException({
          httpExceptionClass: InternalServerErrorException,
          error: { message: 'Failed to transform quote to V2 format' },
        })
      }
    }

    // Handle errors from quote service
    const errorStatus = (error as QuoteErrorsInterface).statusCode

    // Track V2 quote error
    this.ecoAnalytics.trackError(ANALYTICS_EVENTS.QUOTE.V2_RESPONSE_ERROR, error, {
      quoteID: quoteIntentDataDTO.quoteID,
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
      error: { message: error.message || JSON.stringify(error) },
    })
  }
}
