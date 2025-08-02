import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IntentStatus } from '@/common/interfaces/intent.interface';

export type IntentDocument = Intent & Document;

@Schema({ timestamps: true })
export class Intent {
  @Prop({ required: true, unique: true, index: true })
  intentId: string;

  @Prop({ required: true })
  sourceChainId: string;

  @Prop({ required: true })
  targetChainId: string;

  @Prop({ required: true })
  solver: string;

  @Prop({ required: true })
  user: string;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true })
  target: string;

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
    index: true
  })
  status: IntentStatus;

  @Prop()
  txHash?: string;

  @Prop()
  fulfillmentTxHash?: string;

  @Prop({ type: Object })
  metadata?: any;
}

export const IntentSchema = SchemaFactory.createForClass(Intent);

IntentSchema.index({ sourceChainId: 1, status: 1 });
IntentSchema.index({ targetChainId: 1, status: 1 });
IntentSchema.index({ solver: 1, status: 1 });