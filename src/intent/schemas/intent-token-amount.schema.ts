import { RewardTokensInterface } from '@/contracts'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

@Schema({ timestamps: true })
export class TokenAmountDataModel implements RewardTokensInterface {
  @Prop({ required: true, type: String })
  token: Hex
  @Prop({ required: true, type: BigInt })
  amount: bigint

  getRewardTokensInterface?(): RewardTokensInterface {
    return {
      token: this.token,
      amount: BigInt(this.amount.toString()),
    }
  }
}

export const TokenAmountDataSchema = SchemaFactory.createForClass(TokenAmountDataModel)
TokenAmountDataSchema.index({ token: 1 }, { unique: false })
