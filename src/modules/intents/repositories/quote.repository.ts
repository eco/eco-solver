import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import * as api from '@opentelemetry/api';
import { Model } from 'mongoose';

import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Quote, QuoteDocument } from '../schemas/quote.schema';

@Injectable()
export class QuoteRepository {
  constructor(
    @InjectModel(Quote.name)
    private readonly model: Model<QuoteDocument>,
    private readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * Find a quote by quoteID and intentExecutionType
   * @param quoteID Quote identifier
   * @param intentExecutionType Execution type (e.g., 'GASLESS')
   * @returns Quote or null
   */
  async findByQuoteId(quoteID: string, intentExecutionType: string): Promise<Quote | null> {
    const span = this.otelService.startSpan('quote.repository.findByQuoteId', {
      attributes: {
        'quote.id': quoteID,
        'quote.execution_type': intentExecutionType,
      },
    });

    try {
      const result = await this.model.findOne({ quoteID, intentExecutionType }).lean().exec();

      span.setAttribute('quote.found', !!result);
      span.setStatus({ code: api.SpanStatusCode.OK });

      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get a quote by quoteID and intentExecutionType, throws if not found
   * @param quoteID Quote identifier
   * @param intentExecutionType Execution type
   * @returns Quote
   * @throws NotFoundException if quote not found
   */
  async getByQuoteId(quoteID: string, intentExecutionType: string): Promise<Quote> {
    const span = this.otelService.startSpan('quote.repository.getByQuoteId', {
      attributes: {
        'quote.id': quoteID,
        'quote.execution_type': intentExecutionType,
      },
    });

    try {
      const quote = await this.findByQuoteId(quoteID, intentExecutionType);

      if (!quote) {
        const error = new NotFoundException(
          `Quote not found: quoteID=${quoteID}, intentExecutionType=${intentExecutionType}`,
        );

        span.recordException(error);
        span.setStatus({ code: api.SpanStatusCode.ERROR, message: 'Quote not found' });

        throw error;
      }

      span.setStatus({ code: api.SpanStatusCode.OK });

      return quote;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
