import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { RebalanceTokenModel } from './rebalance-token.schema'

@Schema({ timestamps: true })
export class RebalanceModel {
  @Prop({ required: true })
  tokenIn: RebalanceTokenModel

  @Prop({ required: true })
  tokenOut: RebalanceTokenModel

  @Prop({ required: true })
  amountIn: bigint

  @Prop({ required: true })
  amountOut: bigint

  @Prop({ required: true })
  slippage: number

  @Prop({ required: true })
  strategy: LiquidityManager.Strategy

  @Prop({ required: false })
  groupId?: string

  @Prop({ required: true })
  context: LiquidityManager.StrategyContext
}

export const RebalanceSchema = SchemaFactory.createForClass(RebalanceModel)
