import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { UniversalAddress } from '@/common/types/universal-address.type';

@Schema({ _id: false })
export class IntentCall {
  @Prop({ required: true })
  data: string;

  @Prop({ type: String, required: true })
  target: UniversalAddress;

  @Prop({ required: true })
  value: string; // Store bigint as string
}

export const IntentCallSchema = SchemaFactory.createForClass(IntentCall);
