import { RewardTokensInterface } from '@/contracts'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { BigIntSchemaType } from '@/common/schemas/bigint-schema.type'

@Schema({ timestamps: true })
export class QuoteRewardTokenDataModel implements RewardTokensInterface {
  @Prop({ required: true, type: String })
  token: Hex
  @Prop({ required: true, type: BigIntSchemaType })
  amount: bigint
}

export const QuoteRewardTokenDataSchema = SchemaFactory.createForClass(QuoteRewardTokenDataModel)
QuoteRewardTokenDataSchema.index({ token: 1 }, { unique: false })
