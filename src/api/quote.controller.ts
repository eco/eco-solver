import { API_ROOT, QUOTE_ROUTE } from '@/common/routes/constants'
import { convertBigIntsToStrings } from '@/common/viem/utils'
import { QuoteService } from '@/quote/quote.service'
import { CacheInterceptor } from '@nestjs/cache-manager'
import { Controller, Get, UseInterceptors } from '@nestjs/common'

@Controller(API_ROOT + QUOTE_ROUTE)
// @UseInterceptors(CacheInterceptor)
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Get()
  async getQuote() {
    return convertBigIntsToStrings(await this.quoteService.getQuote())
  }
}
