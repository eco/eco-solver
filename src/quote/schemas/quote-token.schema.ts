import { RewardTokensInterface } from '@/contracts'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

@Schema({ timestamps: true })
export class QuoteRewardTokenDataModel implements RewardTokensInterface {
  @Prop({ required: true, type: String })
  token: Hex
  @Prop({ required: true, type: BigInt })
  amount: bigint

  getRewardTokensInterface?(): RewardTokensInterface {
    return {
      token: this.token,
      amount: this.amount,
    }
  }
}

export const QuoteRewardTokenDataSchema = SchemaFactory.createForClass(QuoteRewardTokenDataModel)
QuoteRewardTokenDataSchema.index({ token: 1 }, { unique: false })
