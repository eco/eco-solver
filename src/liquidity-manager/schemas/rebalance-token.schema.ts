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
    // Handle cases where balance data might be incomplete (e.g., in tests)
    const currentBalance =
      tokenData.balance?.balance && tokenData.balance?.decimals
        ? parseFloat(formatUnits(tokenData.balance.balance, tokenData.balance.decimals))
        : 0 // Default to 0 for incomplete data

    return {
      chainId: tokenData.chainId,
      tokenAddress: tokenData.config.address,
      currentBalance,
      targetBalance: tokenData.config.targetBalance || 0, // Default targetBalance if missing
    }
  }
}

export const RebalanceTokenSchema = SchemaFactory.createForClass(RebalanceTokenModel)

// Define indexes
RebalanceTokenSchema.index({ chainId: 1 }, { unique: false })
RebalanceTokenSchema.index({ tokenAddress: 1 }, { unique: false })
