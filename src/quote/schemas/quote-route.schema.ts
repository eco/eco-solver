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
import { VmType } from '@eco-foundation/routes-ts'

@Schema({ timestamps: true })
export class QuoteRouteDataModel implements QuoteRouteDataInterface {
  @Prop({ required: true, type: String })
  vm: VmType
  @Prop({ required: true, type: BigInt })
  deadline: bigint
  @Prop({ required: true, type: BigInt })
  source: bigint
  @Prop({ required: true, type: BigInt })
  destination: bigint
  @Prop({ required: true, type: String })
  portal: Hex
  @Prop({ required: true, type: [TokenAmountDataSchema] })
  tokens: TokenAmountDataModel[]
  @Prop({ required: true, type: [QuoteRouteCallDataSchema] })
  calls: QuoteRouteCallDataModel[]
}

export const QuoteRouteDataSchema = SchemaFactory.createForClass(QuoteRouteDataModel)
QuoteRouteDataSchema.index({ source: 1 }, { unique: false })
QuoteRouteDataSchema.index({ destination: 1 }, { unique: false })
QuoteRouteDataSchema.index({ inbox: 1 }, { unique: false })
