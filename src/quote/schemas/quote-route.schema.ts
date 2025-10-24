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
import { Type } from 'class-transformer'
import { IsArray, ValidateNested } from 'class-validator'
import { Hex } from 'viem'

@Schema({ timestamps: true })
export class QuoteRouteDataModel implements QuoteRouteDataInterface {
  @Prop({ required: true, type: BigInt })
  source: bigint

  @Prop({ required: true, type: BigInt })
  destination: bigint

  @Prop({ required: true, type: String })
  inbox: Hex

  @Prop({ required: true, type: [TokenAmountDataSchema] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TokenAmountDataModel)
  tokens: TokenAmountDataModel[]

  @Prop({ required: true, type: [QuoteRouteCallDataSchema] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteRouteCallDataModel)
  calls: QuoteRouteCallDataModel[]

  getQuoteRouteData?(): QuoteRouteDataInterface {
    return {
      source: BigInt(this.source.toString()),
      destination: BigInt(this.destination.toString()),
      inbox: this.inbox,
      tokens: this.tokens.map((token) => token.getRewardTokensInterface!()),
      calls: this.calls.map((call) => call.getCallDataInterface!()),
    }
  }
}

export const QuoteRouteDataSchema = SchemaFactory.createForClass(QuoteRouteDataModel)
QuoteRouteDataSchema.index({ source: 1 }, { unique: false })
QuoteRouteDataSchema.index({ destination: 1 }, { unique: false })
QuoteRouteDataSchema.index({ inbox: 1 }, { unique: false })
