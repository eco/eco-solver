import { IntentExecutionType } from '@eco-solver/quote/enums/intent-execution-type.enum'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { QuoteIntentDataInterface } from '@eco-solver/quote/dto/quote.intent.data.dto'
import {
  QuoteRewardDataModel,
  QuoteRewardDataSchema,
} from '@eco-solver/quote/schemas/quote-reward.schema'
import {
  QuoteRouteDataModel,
  QuoteRouteDataSchema,
} from '@eco-solver/quote/schemas/quote-route.schema'
import { Types } from 'mongoose'

@Schema({ timestamps: true })
export class QuoteIntentModel implements QuoteIntentDataInterface {
  _id: Types.ObjectId

  @Prop({ required: true, type: String })
  quoteID: string

  @Prop({ required: true, type: String })
  dAppID: string

  @Prop({
    required: true,
    type: String,
    enum: ['SELF_PUBLISH', 'GASLESS'],
  })
  intentExecutionType: string

  // @Prop({ required: true, type: String })
  // routeHash: string

  @Prop({ required: true, type: QuoteRouteDataSchema })
  route: QuoteRouteDataModel

  @Prop({ required: true, type: QuoteRewardDataSchema })
  reward: QuoteRewardDataModel

  @Prop({ type: Object, required: false })
  receipt?: any
}

export const QuoteIntentSchema = SchemaFactory.createForClass(QuoteIntentModel)
QuoteIntentSchema.index({ quoteID: 1 }, { unique: false })
QuoteIntentSchema.index({ dAppID: 1 }, { unique: false })
QuoteIntentSchema.index({ intentExecutionType: 1 }, { unique: false })
// QuoteIntentSchema.index({ routeHash: 1 }, { unique: false })
