import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { IntentCall, IntentCallSchema } from '@/modules/intents/schemas/intent-call.schema';
import { IntentToken, IntentTokenSchema } from '@/modules/intents/schemas/intent-token.schema';

@Schema({ _id: false })
export class IntentRoute {
  @Prop({ type: String, required: true })
  source: string; // Store bigint as string

  @Prop({ type: String, required: true })
  destination: string; // Store bigint as string

  @Prop({ type: String, required: true })
  salt: string;

  @Prop({ type: String, required: true })
  portal: UniversalAddress;

  @Prop({ type: String, required: true })
  deadline: string; // Store bigint as string

  @Prop({ type: String, required: true })
  nativeAmount: string; // Store bigint as string

  @Prop({ type: [IntentCallSchema], required: true })
  calls: IntentCall[];

  @Prop({ type: [IntentTokenSchema], required: true })
  tokens: IntentToken[];
}

export const IntentRouteSchema = SchemaFactory.createForClass(IntentRoute);
