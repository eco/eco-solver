import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { QuoteRewardDataModel, QuoteRewardDataSchema } from '@/quote/schemas/quote-reward.schema'
import { QuoteRouteDataModel, QuoteRouteDataSchema } from '@/quote/schemas/quote-route.schema'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'

@Schema({ timestamps: true })
export class QuoteIntentModel implements QuoteIntentDataInterface {
  _id: Types.ObjectId

  @Prop({ required: true, type: String })
  dAppID: string

  @Prop({ required: false, enum: IntentExecutionType.enumKeys })
  intentExecutionType: string

  @Prop({ required: true, type: String })
  routeHash: string

  @Prop({ required: true, type: QuoteRouteDataSchema })
  route: QuoteRouteDataModel

  @Prop({ required: true, type: QuoteRewardDataSchema })
  reward: QuoteRewardDataModel

  @Prop({ type: Object })
  receipt: any
}

export const QuoteIntentSchema = SchemaFactory.createForClass(QuoteIntentModel)
QuoteIntentSchema.index({ dAppID: 1 }, { unique: false })
QuoteIntentSchema.index({ intentExecutionType: 1 }, { unique: false })
QuoteIntentSchema.index({ routeHash: 1 }, { unique: false })
QuoteIntentSchema.index({ 'route.source': 1 }, { unique: false })
QuoteIntentSchema.index({ 'route.destination': 1 }, { unique: false })
