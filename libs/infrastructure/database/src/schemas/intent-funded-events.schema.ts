import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { WatchEventModel } from './watch-event.schema'

@Schema({ timestamps: true })
export class IntentFundedEventModel extends WatchEventModel {}

export const IntentFundedEventSchema = SchemaFactory.createForClass(IntentFundedEventModel)
