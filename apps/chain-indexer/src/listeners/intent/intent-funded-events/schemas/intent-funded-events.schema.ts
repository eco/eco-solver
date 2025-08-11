import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { WatchEventModel } from '@libs/shared'

@Schema({ timestamps: true })
export class IntentFundedEventModel extends WatchEventModel {}

export const IntentFundedEventSchema = SchemaFactory.createForClass(IntentFundedEventModel)
