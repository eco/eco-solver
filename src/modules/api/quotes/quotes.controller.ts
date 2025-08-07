import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';

import { ValidateRequest } from './decorators/validate-request.decorator';
import { BigIntSerializerInterceptor } from './interceptors/bigint-serializer.interceptor';
import { QuoteRequest, QuoteRequestSchema } from './schemas/quote-request.schema';
import { QuoteResponse } from './schemas/quote-response.schema';
import { QuotesService } from './quotes.service';

@Controller('api/v1/quotes')
@UseInterceptors(BigIntSerializerInterceptor)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @ValidateRequest(QuoteRequestSchema)
  async getQuote(@Body() quoteRequest: QuoteRequest): Promise<QuoteResponse> {
    return this.quotesService.getQuote(quoteRequest.intent, quoteRequest.strategy);
  }
}
