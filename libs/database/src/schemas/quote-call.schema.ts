import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { CallDataInterface } from '@libs/domain'

@Schema({ timestamps: true })
export class QuoteRouteCallDataModel implements CallDataInterface {
  @Prop({ required: true, type: String })
  target: Hex
  @Prop({ required: true, type: String })
  data: Hex
  @Prop({ required: true, type: BigInt })
  value: bigint
}

export const QuoteRouteCallDataSchema = SchemaFactory.createForClass(QuoteRouteCallDataModel)
QuoteRouteCallDataSchema.index({ target: 1 }, { unique: false })
