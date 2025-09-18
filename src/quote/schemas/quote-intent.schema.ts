import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { plainToInstance, Type } from 'class-transformer'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { QuoteRewardDataModel, QuoteRewardDataSchema } from '@/quote/schemas/quote-reward.schema'
import { QuoteRewardDataType } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { QuoteRouteDataModel, QuoteRouteDataSchema } from '@/quote/schemas/quote-route.schema'
import { Types } from 'mongoose'
import { ValidateNested } from 'class-validator'

@Schema({ timestamps: true })
export class QuoteIntentModel implements QuoteIntentDataInterface {
  _id: Types.ObjectId

  @Prop({ required: true, type: String })
  quoteID: string

  @Prop({ required: true, type: String })
  dAppID: string

  @Prop({ required: true, enum: IntentExecutionType.enumKeys })
  intentExecutionType: string

  // @Prop({ required: true, type: String })
  // routeHash: string

  @Prop({ required: true, type: QuoteRouteDataSchema })
  @ValidateNested()
  @Type(() => QuoteRouteDataModel)
  route: QuoteRouteDataModel

  @Prop({ required: true, type: QuoteRewardDataSchema })
  @ValidateNested()
  @Type(() => QuoteRewardDataModel)
  reward: QuoteRewardDataModel

  @Prop({ type: Object })
  receipt: any

  getQuoteRouteData?(): QuoteRouteDataInterface {
    return this.route.getQuoteRouteData!()
  }

  getQuoteRewardData?(): QuoteRewardDataType {
    return this.reward.getQuoteRewardData!()
  }

  static fromJSON(json: any): QuoteIntentModel {
    return json.getQuoteRouteData ? json : plainToInstance(QuoteIntentModel, json)
  }
}

export const QuoteIntentSchema = SchemaFactory.createForClass(QuoteIntentModel)
QuoteIntentSchema.index({ quoteID: 1 }, { unique: false })
QuoteIntentSchema.index({ dAppID: 1 }, { unique: false })
QuoteIntentSchema.index({ intentExecutionType: 1 }, { unique: false })
// QuoteIntentSchema.index({ routeHash: 1 }, { unique: false })
