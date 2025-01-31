import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { API_ROOT, QUOTE_ROUTE } from '@/common/routes/constants'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteService } from '@/quote/quote.service'
import { Body, Controller, Logger, Post } from '@nestjs/common'

@Controller(API_ROOT + QUOTE_ROUTE)
export class QuoteController {
  private logger = new Logger(QuoteController.name)

  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  async getQuote(@Body() quoteIntentDataDTO: QuoteIntentDataDTO) {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received quote request:`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )
    const quote = await this.quoteService.getQuote(quoteIntentDataDTO)
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Responding to quote request:`,
        properties: {
          quote,
        },
      }),
    )
    return quote
  }
}
