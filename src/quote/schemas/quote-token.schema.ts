import { QuoteRewardTokensInterface } from '@/quote/dto/quote.reward.data.dto'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

@Schema({ timestamps: true })
export class QuoteRewardTokenDataModel implements QuoteRewardTokensInterface {
  @Prop({ required: true, type: String })
  token: Hex
  @Prop({ required: true, type: BigInt })
  balance: bigint
}

export const QuoteRewardTokenDataSchema = SchemaFactory.createForClass(QuoteRewardTokenDataModel)
QuoteRewardTokenDataSchema.index({ token: 1 }, { unique: false })
