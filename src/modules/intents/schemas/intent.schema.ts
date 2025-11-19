import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { IntentReward, IntentRewardSchema } from '@/modules/intents/schemas/intent-reward.schema';
import { IntentRoute, IntentRouteSchema } from '@/modules/intents/schemas/intent-route.schema';

export type IntentDocument = Intent & Document;

@Schema({ timestamps: true })
export class Intent {
  @Prop({ required: true, unique: true, index: true })
  intentHash: string;

  @Prop({ required: false })
  intentGroupID?: string;

  @Prop({ type: IntentRewardSchema, required: true })
  reward: IntentReward;

  @Prop({ type: IntentRouteSchema, required: true })
  route: IntentRoute;

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
      errorType: { type: String },
      timestamp: { type: Date },
    },
  })
  lastError?: {
    message: string;
    errorType: string;
    timestamp: Date;
  };

  @Prop({ type: Date, default: Date.now })
  firstSeenAt: Date;

  @Prop({ type: Date })
  lastProcessedAt?: Date;

  @Prop({ type: String, index: true })
  publishTxHash?: string;

  @Prop({
    type: {
      funder: { type: String, required: true },
      complete: { type: Boolean, required: true },
      txHash: { type: String, required: true, index: true },
      blockNumber: { type: String, required: false }, // Store bigint as string
      timestamp: { type: Date, required: true },
      chainId: { type: String, required: true }, // Store bigint as string
    },
  })
  fundedEvent?: {
    funder: string;
    complete: boolean;
    txHash: string;
    blockNumber?: string;
    timestamp: Date;
    chainId: string;
  };

  @Prop({
    type: {
      claimant: { type: String, required: true },
      txHash: { type: String, required: true, index: true },
      blockNumber: { type: String, required: false }, // Store bigint as string
      timestamp: { type: Date, required: true },
      chainId: { type: String, required: true }, // Store bigint as string
    },
  })
  fulfilledEvent?: {
    claimant: string;
    txHash: string;
    blockNumber?: string;
    timestamp: Date;
    chainId: string;
  };

  @Prop({
    type: {
      claimant: { type: String, required: true },
      txHash: { type: String, required: true, index: true },
      blockNumber: { type: String, required: true }, // Store bigint as string
      timestamp: { type: Date, required: true },
      chainId: { type: String, required: true }, // Store bigint as string
    },
  })
  provenEvent?: {
    claimant: string;
    txHash: string;
    blockNumber: string;
    timestamp: Date;
    chainId: string;
  };

  @Prop({
    type: {
      claimant: { type: String, required: true },
      txHash: { type: String, required: true, index: true },
      blockNumber: { type: String, required: true }, // Store bigint as string
      timestamp: { type: Date, required: true },
      chainId: { type: String, required: true }, // Store bigint as string
    },
  })
  withdrawnEvent?: {
    claimant: string;
    txHash: string;
    blockNumber: string;
    timestamp: Date;
    chainId: string;
  };
}

export const IntentSchema = SchemaFactory.createForClass(Intent);

IntentSchema.index({ intentHash: 1 }, { unique: true });
IntentSchema.index({ intentGroupID: 1 }, { unique: false });
IntentSchema.index({ 'route.source': 1, status: 1 });
IntentSchema.index({ 'route.destination': 1, status: 1 });
IntentSchema.index({ 'reward.creator': 1, status: 1 });
// Index for finding proven but not withdrawn intents
IntentSchema.index({ 'provenEvent.chainId': 1, withdrawnEvent: 1 });
IntentSchema.index({ 'provenEvent.timestamp': 1 });
