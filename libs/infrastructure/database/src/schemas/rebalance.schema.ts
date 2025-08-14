import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { RebalanceTokenModel } from './rebalance-token.schema'
import { Strategy, StrategyContext } from '@/liquidity-manager/types/types'

@Schema({ timestamps: true })
export class RebalanceModel {
  @Prop({ required: false })
  wallet?: string

  @Prop({ type: RebalanceTokenModel, required: true })
  tokenIn!: RebalanceTokenModel

  @Prop({ type: RebalanceTokenModel, required: true })
  tokenOut!: RebalanceTokenModel

  @Prop({ type: String, required: true })
  amountIn!: bigint

  @Prop({ type: String, required: true })
  amountOut!: bigint

  @Prop({ required: true })
  slippage!: number

  @Prop({ type: String, required: true })
  strategy!: Strategy

  @Prop({ required: false })
  groupId?: string

  @Prop({ required: false, type: Object })
  context?: StrategyContext
}

export const RebalanceSchema = SchemaFactory.createForClass(RebalanceModel)
