import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { WatchEventModel } from '@eco/infrastructure-database'

@Schema({ timestamps: true })
export class IntentFundedEventModel extends WatchEventModel {}

export const IntentFundedEventSchema = SchemaFactory.createForClass(IntentFundedEventModel)
