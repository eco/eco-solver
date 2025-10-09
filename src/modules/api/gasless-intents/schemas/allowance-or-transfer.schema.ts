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

  @Prop({ required: true, type: String })
  amountDelta: string; // Store bigint as string
}

export const AllowanceOrTransferSchema = SchemaFactory.createForClass(AllowanceOrTransfer);
