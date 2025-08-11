import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { QuoteRouteDataInterface } from '@libs/domain'
import {
  TokenAmountDataModel,
  TokenAmountDataSchema,
} from './intent-token-amount.schema'
import {
  QuoteRouteCallDataModel,
  QuoteRouteCallDataSchema,
} from './quote-call.schema'

@Schema({ timestamps: true })
export class QuoteRouteDataModel implements QuoteRouteDataInterface {
  @Prop({ required: true, type: BigInt })
  source: bigint
  @Prop({ required: true, type: BigInt })
  destination: bigint
  @Prop({ required: true, type: String })
  inbox: Hex
  @Prop({ required: true, type: [TokenAmountDataSchema] })
  tokens: TokenAmountDataModel[]
  @Prop({ required: true, type: [QuoteRouteCallDataSchema] })
  calls: QuoteRouteCallDataModel[]
}

export const QuoteRouteDataSchema = SchemaFactory.createForClass(QuoteRouteDataModel)
QuoteRouteDataSchema.index({ source: 1 }, { unique: false })
QuoteRouteDataSchema.index({ destination: 1 }, { unique: false })
QuoteRouteDataSchema.index({ inbox: 1 }, { unique: false })
