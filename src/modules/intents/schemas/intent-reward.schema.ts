import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { IntentToken, IntentTokenSchema } from '@/modules/intents/schemas/intent-token.schema';

@Schema({ _id: false })
export class IntentReward {
  @Prop({ type: String, required: true })
  prover: UniversalAddress;

  @Prop({ type: String, required: true })
  creator: UniversalAddress;

  @Prop({ type: String, required: true })
  deadline: string; // Store bigint as string

  @Prop({ type: String, required: true })
  nativeAmount: string; // Store bigint as string

  @Prop({ type: [IntentTokenSchema], required: true })
  tokens: IntentToken[];
}

export const IntentRewardSchema = SchemaFactory.createForClass(IntentReward);
