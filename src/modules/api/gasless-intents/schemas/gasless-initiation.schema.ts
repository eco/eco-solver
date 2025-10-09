import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Type } from 'class-transformer';
import { Document } from 'mongoose';

import { Permit3, Permit3Schema } from './permit3.schema';

export type GaslessInitiationDocument = GaslessInitiation & Document;

@Schema({ timestamps: true })
export class GaslessInitiation {
  @Prop({ required: true, unique: true, index: true })
  gaslessInitiationId: string;

  @Prop({ required: false })
  destinationChainID?: number;

  @Prop({ required: false })
  destinationChainTxHash?: string; // Hex string

  @Prop({ type: Permit3Schema, required: false })
  @Type(() => Permit3)
  permit3?: Permit3;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const GaslessInitiationSchema = SchemaFactory.createForClass(GaslessInitiation);

// Define indexes
GaslessInitiationSchema.index({ gaslessInitiationId: 1 }, { unique: true });
GaslessInitiationSchema.index({ destinationChainID: 1 }, { unique: false });
GaslessInitiationSchema.index({ destinationChainTxHash: 1 }, { unique: false });
GaslessInitiationSchema.index({ createdAt: 1 }, { unique: false });
GaslessInitiationSchema.index({ updatedAt: 1 }, { unique: false });
