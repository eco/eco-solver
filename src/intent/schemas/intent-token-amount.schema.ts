import { RewardTokensInterface } from '@/contracts'
import { Address } from '@/eco-configs/eco-config.types'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

@Schema({ timestamps: true })
export class TokenAmountDataModel {
  @Prop({ required: true, type: String })
  token: Address
  @Prop({ required: true, type: BigInt })
  amount: bigint
}

export const TokenAmountDataSchema = SchemaFactory.createForClass(TokenAmountDataModel)
TokenAmountDataSchema.index({ token: 1 }, { unique: false })
