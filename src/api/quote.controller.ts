import { API_ROOT, QUOTE_ROUTE } from '@/common/routes/constants'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteService } from '@/quote/quote.service'
import { Body, Controller, Post } from '@nestjs/common'

@Controller(API_ROOT + QUOTE_ROUTE)
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  async getQuote(@Body() quoteIntentDataDTO: QuoteIntentDataDTO) {
    return await this.quoteService.getQuote(quoteIntentDataDTO)
  }
}
