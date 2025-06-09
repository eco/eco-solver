import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { WatchEventModel } from '@/intent/schemas/watch-event.schema'

@Schema({ timestamps: true })
export class IntentFundedEventModel extends WatchEventModel {}

export const IntentFundedEventSchema = SchemaFactory.createForClass(IntentFundedEventModel)
