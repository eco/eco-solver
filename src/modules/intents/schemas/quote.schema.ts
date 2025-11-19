import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

import { IntentExecutionType } from '@/modules/api/quotes/enums/intent-execution-type.enum';

export type QuoteDocument = Quote & Document;

/**
 * Quote schema matching QuoteDataSchema
 * Stores quote data for gasless intent execution
 */
@Schema({ timestamps: true })
export class Quote {
  @Prop({ required: true })
  quoteID: string;

  @Prop({ required: true, enum: IntentExecutionType.enumKeys })
  intentExecutionType: string;

  @Prop({ required: true })
  sourceChainID: number;

  @Prop({ required: true })
  destinationChainID: number;

  @Prop({ required: true })
  sourceToken: string;

  @Prop({ required: true })
  destinationToken: string;

  @Prop({ required: true })
  sourceAmount: string; // Store bigint as string

  @Prop({ required: true })
  destinationAmount: string; // Store bigint as string

  @Prop({ required: true })
  funder: string;

  @Prop({ required: true })
  refundRecipient: string;

  @Prop({ required: true })
  recipient: string;

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        description: { type: String, required: true },
        token: {
          address: { type: String, required: true },
          decimals: { type: Number, required: true },
          symbol: { type: String, required: true },
        },
        amount: { type: String, required: true }, // Store bigint as string
      },
    ],
    required: true,
  })
  fees: Array<{
    name: string;
    description: string;
    token: {
      address: string;
      decimals: number;
      symbol: string;
    };
    amount: string;
  }>;

  @Prop({ required: true })
  deadline: number;

  @Prop({ required: true })
  estimatedFulfillTimeSec: number;

  @Prop({ required: true })
  encodedRoute: string;

  @Prop({ type: Object, required: true })
  intent: Record<string, any>;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);

QuoteSchema.index({ quoteID: 1 }, { unique: false });
QuoteSchema.index({ intentExecutionType: 1 }, { unique: false });
QuoteSchema.index({ sourceChainID: 1 }, { unique: false });
QuoteSchema.index({ destinationChainID: 1 }, { unique: false });
QuoteSchema.index({ createdAt: 1 }, { unique: false });
QuoteSchema.index({ updatedAt: 1 }, { unique: false });
