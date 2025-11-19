import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Document } from 'mongoose';

import { Permit3, Permit3Schema } from './permit3.schema';

export type GaslessInitiationIntentDocument = GaslessInitiationIntent & Document;

@Schema({ timestamps: true })
export class GaslessInitiationIntent {
  @Prop({ required: true })
  intentGroupID: string;

  @Prop({ required: false })
  destinationChainID?: number;

  @Prop({ required: false })
  destinationChainTxHash?: string; // Hex string

  @Prop({ type: Permit3Schema, required: false })
  @ValidateNested()
  @Type(() => Permit3)
  permit3?: Permit3;

  @Prop({ type: Date, required: false })
  createdAt?: Date;

  @Prop({ type: Date, required: false })
  updatedAt?: Date;
}

export const GaslessInitiationIntentSchema = SchemaFactory.createForClass(GaslessInitiationIntent);

// Define indexes
GaslessInitiationIntentSchema.index({ intentGroupID: 1 }, { unique: true });
GaslessInitiationIntentSchema.index({ destinationChainID: 1 }, { unique: false });
GaslessInitiationIntentSchema.index({ destinationChainTxHash: 1 }, { unique: false });
GaslessInitiationIntentSchema.index({ createdAt: 1 }, { unique: false });
GaslessInitiationIntentSchema.index({ updatedAt: 1 }, { unique: false });
