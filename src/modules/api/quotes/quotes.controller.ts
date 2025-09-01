import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ApiZodBody, ApiZodResponse } from '@/common/decorators/zod-schema.decorator';

import { ValidateRequest } from './decorators/validate-request.decorator';
import { BigIntSerializerInterceptor } from './interceptors/bigint-serializer.interceptor';
import { BadRequestResponseSchema } from './schemas/error-response.schema';
import { QuoteRequest, QuoteRequestSchema } from './schemas/quote-request.schema';
import {
  FailedQuoteResponseSchema,
  QuoteResponse,
  SuccessfulQuoteResponseSchema,
} from './schemas/quote-response.schema';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiSecurity('api-key')
@Controller('api/v1/quotes')
@UseGuards(ThrottlerGuard)
@UseInterceptors(BigIntSerializerInterceptor)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a quote for an intent',
    description:
      'Validates an intent and returns a quote with fee requirements. ' +
      'This endpoint performs comprehensive validation using the selected strategy ' +
      'and calculates all required fees for fulfillment.',
  })
  @ApiZodBody(QuoteRequestSchema, 'Intent data and optional strategy selection')
  @ApiZodResponse(
    HttpStatus.OK,
    SuccessfulQuoteResponseSchema,
    'Quote successfully generated with fees and contract addresses',
  )
  @ApiZodResponse(HttpStatus.BAD_REQUEST, FailedQuoteResponseSchema, 'Intent validation failed')
  @ApiZodResponse(
    HttpStatus.BAD_REQUEST,
    BadRequestResponseSchema,
    'Invalid request format or validation errors',
  )
  @ValidateRequest(QuoteRequestSchema)
  async getQuote(@Body() quoteRequest: QuoteRequest): Promise<QuoteResponse> {
    return this.quotesService.getQuote(quoteRequest.intent, quoteRequest.strategy);
  }
}
