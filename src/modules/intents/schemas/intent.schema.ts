import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Schema as MongooseSchema } from 'mongoose';

import { IntentStatus } from '@/common/interfaces/intent.interface';

export type IntentDocument = Intent & Document;

@Schema({ timestamps: true })
export class Intent {
  @Prop({ required: true, unique: true, index: true })
  intentId: string;

  @Prop({
    type: {
      chainId: { type: MongooseSchema.Types.Mixed, required: true },
      address: { type: String, required: true },
      txHash: { type: String, required: false },
    },
    required: true,
  })
  source: {
    chainId: string | number;
    address: string;
    txHash?: string;
  };

  @Prop({
    type: {
      chainId: { type: MongooseSchema.Types.Mixed, required: true },
      address: { type: String, required: true },
      txHash: { type: String, required: false },
    },
    required: true,
  })
  target: {
    chainId: string | number;
    address: string;
    txHash?: string;
  };

  @Prop({ required: true })
  solver: string;

  @Prop({ required: true })
  user: string;

  @Prop({ required: true })
  data: string;

  @Prop({ required: true })
  value: string;

  @Prop({ required: true })
  reward: string;

  @Prop({ required: true })
  deadline: number;

  @Prop({ required: true })
  timestamp: number;

  @Prop({
    required: true,
    enum: IntentStatus,
    default: IntentStatus.PENDING,
    index: true,
  })
  status: IntentStatus;

  @Prop({ type: Object })
  metadata?: any;
}

export const IntentSchema = SchemaFactory.createForClass(Intent);

IntentSchema.index({ 'source.chainId': 1, status: 1 });
IntentSchema.index({ 'target.chainId': 1, status: 1 });
IntentSchema.index({ solver: 1, status: 1 });
