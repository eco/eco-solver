import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

@Schema()
export class RebalanceTokenModel {
  @Prop({ required: true })
  chainId: number

  @Prop({ required: true })
  tokenAddress: Hex

  @Prop({ required: true })
  currentBalance: number

  @Prop({ required: true })
  targetBalance: number

  static fromTokenData(tokenData: LiquidityManager.TokenData): RebalanceTokenModel {
    return {
      chainId: tokenData.chainId,
      tokenAddress: tokenData.config.address,
      currentBalance: tokenData.balance,
      targetBalance: tokenData.config.targetBalance,
    }
  }
}

export const RebalanceTokenSchema = SchemaFactory.createForClass(RebalanceTokenModel)
