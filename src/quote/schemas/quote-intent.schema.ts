import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { QuoteRewardDataModel, QuoteRewardDataSchema } from '@/quote/schemas/quote-reward.schema'
import { QuoteRouteDataModel, QuoteRouteDataSchema } from '@/quote/schemas/quote-route.schema'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'

@Schema({ timestamps: true })
export class QuoteIntentModel implements QuoteIntentDataInterface {
  _id: Types.ObjectId

  @Prop({ required: true, type: QuoteRouteDataSchema })
  route: QuoteRouteDataModel

  @Prop({ required: true, type: QuoteRewardDataSchema })
  reward: QuoteRewardDataModel

  @Prop({ type: Object })
  receipt: any
}

export const QuoteIntentSchema = SchemaFactory.createForClass(QuoteIntentModel)
QuoteIntentSchema.index({ 'route.source': 1 }, { unique: false })
QuoteIntentSchema.index({ 'route.destination': 1 }, { unique: false })
