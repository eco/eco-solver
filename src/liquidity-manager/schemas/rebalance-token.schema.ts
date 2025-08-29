import { TokenData } from '@/liquidity-manager/types/types'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { formatUnits, Hex } from 'viem'

@Schema()
export class RebalanceTokenModel {
  @Prop({ required: true, index: true })
  chainId: number

  @Prop({ required: true, index: true })
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
      tokenAddress: tokenData.config.address,
      currentBalance,
      targetBalance: tokenData.config.targetBalance,
    }
  }
}

export const RebalanceTokenSchema = SchemaFactory.createForClass(RebalanceTokenModel)

// Define indexes
RebalanceTokenSchema.index({ chainId: 1 }, { unique: false })
RebalanceTokenSchema.index({ tokenAddress: 1 }, { unique: false })
