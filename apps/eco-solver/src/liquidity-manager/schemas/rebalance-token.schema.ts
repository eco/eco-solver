import { TokenData } from '@eco-solver/liquidity-manager/types/types'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { formatUnits } from "viem"
import { Hex } from "viem"

@Schema()
export class RebalanceTokenModel {
  @Prop({ required: true })
  chainId: number

  @Prop({ required: true, type: String })
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
