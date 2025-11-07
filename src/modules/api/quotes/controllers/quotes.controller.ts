import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ApiZodBody, ApiZodResponse } from '@/common/decorators/zod-schema.decorator';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoLogger } from '@/common/logging/eco-logger';
import { API_V2_ROOT } from '@/modules/api/paths';
import { QUOTE_ROUTE } from '@/modules/api/quotes/constants/endpoint';
import { ValidateRequest } from '@/modules/api/quotes/decorators';

import { BigIntSerializerInterceptor } from '../interceptors/bigint-serializer.interceptor';
import { BadRequestResponseSchema } from '../schemas/error-response.schema';
import { QuoteRequest, QuoteRequestSchema } from '../schemas/quote-request.schema';
import {
  FailedQuoteResponseSchema,
  QuoteResponse,
  SuccessfulQuoteResponseSchema,
} from '../schemas/quote-response.schema';
import { QuotesService } from '../services/quotes.service';

@ApiTags('quotes')
@Controller(API_V2_ROOT + QUOTE_ROUTE)
@UseGuards(ThrottlerGuard)
@UseInterceptors(BigIntSerializerInterceptor)
export class QuotesController {
  private logger = new EcoLogger(QuotesController.name);
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a quote for a cross-chain token swap',
    description:
      'Validates a cross-chain swap request and returns a quote with fee requirements. ' +
      'This endpoint performs comprehensive validation and calculates all required fees for fulfillment.',
  })
  @ApiZodBody(QuoteRequestSchema, 'Cross-chain token swap request')
  @ApiZodResponse(
    HttpStatus.OK,
    SuccessfulQuoteResponseSchema,
    'Quote successfully generated with fees and contract addresses',
  )
  @ApiZodResponse(HttpStatus.BAD_REQUEST, FailedQuoteResponseSchema, 'Validation failed')
  @ApiZodResponse(
    HttpStatus.BAD_REQUEST,
    BadRequestResponseSchema,
    'Invalid request format or validation errors',
  )
  @ValidateRequest(QuoteRequestSchema)
  async getQuote(@Body() quoteRequest: QuoteRequest): Promise<QuoteResponse> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Received quotes request:`,
        properties: {
          quoteRequest,
        },
      }),
    );

    const response = await this.quotesService.getQuote(quoteRequest);

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Quotes request response:`,
        properties: {
          response,
        },
      }),
    );

    return response;
  }

  @Post('/reverse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a quote for a cross-chain token swap',
    description:
      'Validates a cross-chain swap request and returns a quote with fee requirements. ' +
      'This endpoint performs comprehensive validation and calculates all required fees for fulfillment.',
  })
  @ApiZodBody(QuoteRequestSchema, 'Cross-chain token swap request')
  @ApiZodResponse(
    HttpStatus.OK,
    SuccessfulQuoteResponseSchema,
    'Quote successfully generated with fees and contract addresses',
  )
  @ApiZodResponse(HttpStatus.BAD_REQUEST, FailedQuoteResponseSchema, 'Validation failed')
  @ApiZodResponse(
    HttpStatus.BAD_REQUEST,
    BadRequestResponseSchema,
    'Invalid request format or validation errors',
  )
  @ValidateRequest(QuoteRequestSchema)
  async getReverseQuote(@Body() quoteRequest: QuoteRequest): Promise<QuoteResponse> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Received reverse quotes request:`,
        properties: {
          quoteRequest,
        },
      }),
    );

    const response = await this.quotesService.getReverseQuote(quoteRequest);

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Reverse quotes request response:`,
        properties: {
          response,
        },
      }),
    );

    return response;
  }
}
