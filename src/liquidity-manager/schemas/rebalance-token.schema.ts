import { TokenData } from '@/liquidity-manager/types/types'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { formatUnits, Hex } from 'viem'

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

  static fromTokenData(tokenData: TokenData): RebalanceTokenModel {
    const currentBalance = parseFloat(
      formatUnits(tokenData.balance.balance, tokenData.balance.decimals),
    )
    return {
      chainId: tokenData.chainId,
      tokenAddress: tokenData.config.address as `0x${string}`,
      currentBalance,
      targetBalance: tokenData.config.targetBalance,
    }
  }
}

export const RebalanceTokenSchema = SchemaFactory.createForClass(RebalanceTokenModel)
