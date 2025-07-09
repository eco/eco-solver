import { TokenData } from '@/liquidity-manager/types/types'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

@Schema()
export class RebalanceTokenModel {
  @Prop({ required: true })
  chainId: number

  @Prop({ required: true })
  tokenAddress: Hex

  @Prop({ required: true })
  currentBalance: bigint

  @Prop({ required: true })
  targetBalance: bigint

  static fromTokenData(tokenData: TokenData): RebalanceTokenModel {
    return {
      chainId: tokenData.chainId,
      tokenAddress: tokenData.config.address,
      currentBalance: tokenData.balance.balance,
      targetBalance: tokenData.config.targetBalance,
    }
  }
}

export const RebalanceTokenSchema = SchemaFactory.createForClass(RebalanceTokenModel)
