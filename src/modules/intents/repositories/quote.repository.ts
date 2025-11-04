import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import * as api from '@opentelemetry/api';
import { Model } from 'mongoose';

import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoLogger } from '@/common/logging/eco-logger';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { Quote, QuoteDocument } from '../schemas/quote.schema';

@Injectable()
export class QuoteRepository {
  private logger = new EcoLogger(QuoteRepository.name);

  constructor(
    @InjectModel(Quote.name)
    private readonly model: Model<QuoteDocument>,
    private readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * Find a quote by quoteID
   * @param quoteID Quote identifier
   * @returns Quote or null
   */
  async findByQuoteID(quoteID: string): Promise<Quote | null> {
    const span = this.otelService.startSpan('quote.repository.findByQuoteId', {
      attributes: {
        'quote.id': quoteID,
      },
    });

    try {
      const result = await this.model.findOne({ quoteID }).lean().exec();

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
   * Get a quote by quoteID, throws if not found
   * @param quoteID Quote identifier
   * @returns Quote
   * @throws NotFoundException if quote not found
   */
  async getByQuoteID(quoteID: string): Promise<Quote> {
    const span = this.otelService.startSpan('quote.repository.getByQuoteId', {
      attributes: {
        'quote.id': quoteID,
      },
    });

    try {
      const quote = await this.findByQuoteID(quoteID);

      if (!quote) {
        const error = new NotFoundException(`Quote not found: quoteID=${quoteID}`);

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

  /**
   * Create and save a new quote
   * @param quote Quote data to save
   * @returns Saved quote
   */
  async create(quote: Quote): Promise<Quote> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `create quote`,
        properties: {
          quote,
        },
      }),
    );

    const span = this.otelService.startSpan('quote.repository.create', {
      attributes: {
        'quote.id': quote.quoteID,
        'quote.source_chain': quote.sourceChainID,
        'quote.destination_chain': quote.destinationChainID,
      },
    });

    try {
      const newQuote = new this.model(quote);
      const saved = await newQuote.save();

      span.setStatus({ code: api.SpanStatusCode.OK });

      return saved.toObject();
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
