import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { AllowanceOrTransfer, AllowanceOrTransferSchema } from './allowance-or-transfer.schema';

@Schema({ _id: false })
export class Permit3 {
  @Prop({ required: true })
  chainId: number;

  @Prop({ required: true })
  permitContract: string;

  @Prop({ required: true })
  owner: string;

  @Prop({ required: true })
  salt: string; // Hex string

  @Prop({ required: true })
  signature: string; // Hex string

  @Prop({ required: true, type: BigInt })
  deadline: bigint; // UNIX seconds since epoch integer

  @Prop({ required: true })
  timestamp: number;

  @Prop({ required: true })
  merkleRoot: string; // Hex string

  @Prop({ type: [String], required: false })
  leaves?: string[]; // Array of Hex strings

  @Prop({ type: [AllowanceOrTransferSchema], required: true })
  @ValidateNested()
  @Type(() => AllowanceOrTransfer)
  allowanceOrTransfers: AllowanceOrTransfer[];
}

export const Permit3Schema = SchemaFactory.createForClass(Permit3);
