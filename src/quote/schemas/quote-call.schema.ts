import { CallDataInterface } from '@/contracts'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { BigIntSchemaType } from '@/common/schemas/bigint-schema.type'

@Schema({ timestamps: true })
export class QuoteRouteCallDataModel implements CallDataInterface {
  @Prop({ required: true, type: String })
  target: Hex
  @Prop({ required: true, type: String })
  data: Hex
  @Prop({ required: true, type: BigIntSchemaType })
  value: bigint
}

export const QuoteRouteCallDataSchema = SchemaFactory.createForClass(QuoteRouteCallDataModel)
QuoteRouteCallDataSchema.index({ token: 1 }, { unique: false })
