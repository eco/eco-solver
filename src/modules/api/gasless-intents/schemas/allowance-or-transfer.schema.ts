import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class AllowanceOrTransfer {
  @Prop({ required: true })
  chainID: number;

  @Prop({ required: true })
  modeOrExpiration: number;

  @Prop({ required: true })
  tokenKey: string; // Hex string

  @Prop({ required: true })
  account: string; // Hex string

  @Prop({ required: true, type: BigInt })
  amountDelta: bigint;
}

export const AllowanceOrTransferSchema = SchemaFactory.createForClass(AllowanceOrTransfer);
