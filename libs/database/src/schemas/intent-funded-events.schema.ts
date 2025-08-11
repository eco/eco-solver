@Schema({ timestamps: true })
export class IntentFundedEventModel extends WatchEventModel {}

export const IntentFundedEventSchema = SchemaFactory.createForClass(IntentFundedEventModel)
