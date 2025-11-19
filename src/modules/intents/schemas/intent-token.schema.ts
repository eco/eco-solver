import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { UniversalAddress } from '@/common/types/universal-address.type';

@Schema({ _id: false })
export class IntentToken {
  @Prop({ required: true })
  amount: string; // Store bigint as string

  @Prop({ type: String, required: true })
  token: UniversalAddress;
}

export const IntentTokenSchema = SchemaFactory.createForClass(IntentToken);
