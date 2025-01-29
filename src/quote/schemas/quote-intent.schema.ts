import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { QuoteRewardDataModel } from '@/quote/schemas/quote-reward.schema'
import { QuoteRouteDataModel } from '@/quote/schemas/quote-route.schema'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

@Schema({ timestamps: true })
export class QuoteIntentModel implements QuoteIntentDataInterface {
  @Prop({ required: true })
  route: QuoteRouteDataModel

  @Prop({ required: true })
  reward: QuoteRewardDataModel
}

export const QuoteIntentSchema = SchemaFactory.createForClass(QuoteIntentModel)
QuoteIntentSchema.index({ 'route.source': 1 }, { unique: false })
QuoteIntentSchema.index({ 'route.destination': 1 }, { unique: false })
