import { CallDataInterface } from '@eco/shared-types'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

@Schema({ timestamps: true })
export class QuoteRouteCallDataModel implements CallDataInterface {
  @Prop({ required: true, type: String })
  target!: Hex
  @Prop({ required: true, type: String })
  data!: Hex
  @Prop({ required: true, type: BigInt })
  value!: bigint
}

export const QuoteRouteCallDataSchema = SchemaFactory.createForClass(QuoteRouteCallDataModel)
QuoteRouteCallDataSchema.index({ token: 1 }, { unique: false })
