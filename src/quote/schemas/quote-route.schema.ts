import {
  TokenAmountDataModel,
  TokenAmountDataSchema,
} from '@/intent/schemas/intent-token-amount.schema'
import { QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import {
  QuoteRouteCallDataModel,
  QuoteRouteCallDataSchema,
} from '@/quote/schemas/quote-call.schema'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { BigIntSchemaType } from '@/common/schemas/bigint-schema.type'

@Schema({ timestamps: true })
export class QuoteRouteDataModel implements QuoteRouteDataInterface {
  @Prop({ required: true, type: BigIntSchemaType })
  source: bigint
  @Prop({ required: true, type: BigIntSchemaType })
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
