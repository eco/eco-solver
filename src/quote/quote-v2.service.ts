import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteService } from '@/quote/quote.service'
import { QuoteV2RequestDTO } from '@/quote/dto/v2/quote-v2-request.dto'
import { QuoteV2RequestTransformService } from '@/quote/services/quote-v2-request-transform.service'
import { QuoteV2ResponseDTO } from '@/quote/dto/v2/quote-v2-response.dto'
import { QuoteV2TransformService } from '@/quote/services/quote-v2-transform.service'

@Injectable()
export class QuoteV2Service implements OnModuleInit {
  private readonly logger = new EcoLogger(QuoteV2Service.name)

  constructor(
    private readonly quoteService: QuoteService,
    private readonly quoteV2TransformService: QuoteV2TransformService,
    private readonly quoteV2RequestTransformService: QuoteV2RequestTransformService,
  ) {}

  onModuleInit() {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${QuoteV2Service.name}.onModuleInit()`,
      }),
    )
  }

  async getQuote(v2Request: QuoteV2RequestDTO): Promise<EcoResponse<QuoteV2ResponseDTO>> {
    // Transform V2 request to QuoteIntentDataDTO
    const { response: quoteIntentDataDTO, error: transformError } =
      this.quoteV2RequestTransformService.transformToQuoteIntentForward(v2Request)

    if (transformError) {
      return { error: transformError }
    }

    const { response: quote, error } = await this.quoteService.getQuote(quoteIntentDataDTO!)

    if (error) {
      return { error }
    }

    return this.transformToV2(quote!, quoteIntentDataDTO!)
  }

  async getReverseQuote(v2Request: QuoteV2RequestDTO): Promise<EcoResponse<QuoteV2ResponseDTO>> {
    // Transform V2 request to QuoteIntentDataDTO
    const { response: quoteIntentDataDTO, error: transformError } =
      this.quoteV2RequestTransformService.transformToQuoteIntentReverse(v2Request)

    if (transformError) {
      return { error: transformError }
    }

    const { response: quote, error } = await this.quoteService.getReverseQuote(quoteIntentDataDTO!)

    if (error) {
      return { error }
    }

    return this.transformToV2(quote!, quoteIntentDataDTO!)
  }

  async transformToV2(
    quote: QuoteDataDTO,
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): Promise<EcoResponse<QuoteV2ResponseDTO>> {
    try {
      // Transform to V2 format
      const v2Response = await this.quoteV2TransformService.transformToV2(quote, quoteIntentDataDTO)

      if (!v2Response) {
        return { error: EcoError.InvalidQuoteResponse }
      }

      return { response: v2Response }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error transforming quote to V2 format:`,
          properties: {
            error: ex.message,
            quoteID: quoteIntentDataDTO.quoteID,
          },
        }),
      )

      return { error: EcoError.InvalidQuoteResponse }
    }
  }
}
