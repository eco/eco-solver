import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

import { IntentStatus } from '@/common/interfaces/intent.interface';

export type IntentDocument = Intent & Document;

@Schema({ timestamps: true })
export class Intent {
  @Prop({ required: true, unique: true, index: true })
  intentHash: string;

  @Prop({
    type: {
      prover: { type: String, required: true },
      creator: { type: String, required: true },
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
    prover: string;
    creator: string;
    deadline: string;
    nativeAmount: string;
    tokens: {
      amount: string;
      token: string;
    }[];
  };

  @Prop({
    type: {
      source: { type: String, required: true }, // Store bigint as string
      destination: { type: String, required: true }, // Store bigint as string
      salt: { type: String, required: true },
      inbox: { type: String, required: true },
      deadline: { type: String, required: true }, // Store bigint as string
      nativeAmount: { type: String, required: true }, // Store bigint as string
      calls: [
        {
          data: { type: String, required: true },
          target: { type: String, required: true },
          value: { type: String, required: true }, // Store bigint as string
        },
      ],
      tokens: [
        {
          amount: { type: String, required: true }, // Store bigint as string
          token: { type: String, required: true },
        },
      ],
    },
    required: true,
  })
  route: {
    source: string;
    destination: string;
    salt: string;
    inbox: string;
    deadline: bigint;
    nativeAmount: bigint;
    calls: {
      data: string;
      target: string;
      value: string;
    }[];
    tokens: {
      amount: string;
      token: string;
    }[];
  };

  @Prop({
    required: true,
    enum: IntentStatus,
    default: IntentStatus.PENDING,
    index: true,
  })
  status: IntentStatus;

  @Prop({ type: Date, default: Date.now })
  lastSeen: Date;

  @Prop({ type: Number, default: 0 })
  retryCount: number;

  @Prop({
    type: {
      message: { type: String },
      type: { type: String },
      timestamp: { type: Date },
    },
  })
  lastError?: {
    message: string;
    type: string;
    timestamp: Date;
  };

  @Prop({ type: Date, default: Date.now })
  firstSeenAt: Date;

  @Prop({ type: Date })
  lastProcessedAt?: Date;
}

export const IntentSchema = SchemaFactory.createForClass(Intent);

IntentSchema.index({ 'route.source': 1, status: 1 });
IntentSchema.index({ 'route.destination': 1, status: 1 });
IntentSchema.index({ 'reward.creator': 1, status: 1 });
