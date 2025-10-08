import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

import { UniversalAddress } from '@/common/types/universal-address.type';

export type QuoteDocument = Quote & Document;

/**
 * Simplified quote schema for gasless intents
 * Stores essential route and reward data needed for intent initiation
 */
@Schema({ timestamps: true })
export class Quote {
  @Prop({ required: true, unique: true, index: true })
  quoteID: string;

  @Prop({ required: true, index: true })
  dAppID: string;

  @Prop({ required: true, index: true })
  intentExecutionType: string; // e.g., 'GASLESS', 'SELF_PUBLISH'

  // Route data
  @Prop({
    type: {
      source: { type: String, required: true }, // Store bigint as string
      destination: { type: String, required: true }, // Store bigint as string
      salt: { type: String, required: true },
      portal: { type: String, required: true },
      deadline: { type: String, required: true }, // Store bigint as string
      nativeAmount: { type: String, required: true }, // Store bigint as string
      tokens: [
        {
          amount: { type: String, required: true }, // Store bigint as string
          token: { type: String, required: true },
        },
      ],
      calls: [
        {
          data: { type: String, required: true },
          target: { type: String, required: true },
          value: { type: String, required: true }, // Store bigint as string
        },
      ],
    },
    required: true,
  })
  route: {
    source: string;
    destination: string;
    salt: string;
    portal: UniversalAddress;
    deadline: string;
    nativeAmount: string;
    tokens: {
      amount: string;
      token: UniversalAddress;
    }[];
    calls: {
      data: string;
      target: UniversalAddress;
      value: string;
    }[];
  };

  // Reward data
  @Prop({
    type: {
      creator: { type: String, required: true },
      prover: { type: String, required: true },
      deadline: { type: String, required: true }, // Store bigint as string
      nativeAmount: { type: String, required: true }, // Store bigint as string
      tokens: [
        {
          amount: { type: String, required: true }, // Store bigint as string
          token: { type: String, required: true },
        },
      ],
    },
    required: true,
  })
  reward: {
    creator: UniversalAddress;
    prover: UniversalAddress;
    deadline: string;
    nativeAmount: string;
    tokens: {
      amount: string;
      token: UniversalAddress;
    }[];
  };

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);

QuoteSchema.index({ quoteID: 1 }, { unique: true });
QuoteSchema.index({ dAppID: 1 });
QuoteSchema.index({ intentExecutionType: 1 });
QuoteSchema.index({ 'route.source': 1 });
QuoteSchema.index({ 'route.destination': 1 });
