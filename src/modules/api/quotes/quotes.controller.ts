import { Body, Controller, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ApiKeyGuard } from '@/common/guards/api-key.guard';

import { ValidateRequest } from './decorators/validate-request.decorator';
import { BigIntSerializerInterceptor } from './interceptors/bigint-serializer.interceptor';
import { QuoteRequest, QuoteRequestSchema } from './schemas/quote-request.schema';
import { QuoteResponse } from './schemas/quote-response.schema';
import { QuotesService } from './quotes.service';

@Controller('api/v1/quotes')
@UseGuards(ThrottlerGuard, ApiKeyGuard)
@UseInterceptors(BigIntSerializerInterceptor)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @ValidateRequest(QuoteRequestSchema)
  async getQuote(@Body() quoteRequest: QuoteRequest): Promise<QuoteResponse> {
    return this.quotesService.getQuote(quoteRequest.intent, quoteRequest.strategy);
  }
}
