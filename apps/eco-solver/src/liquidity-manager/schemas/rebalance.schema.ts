import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { RebalanceTokenModel } from './rebalance-token.schema'
import { Strategy, StrategyContext } from '../types/types'

@Schema({ timestamps: true })
export class RebalanceModel {
  @Prop({ required: false })
  wallet?: string

  @Prop({ required: true })
  tokenIn: RebalanceTokenModel

  @Prop({ required: true })
  tokenOut: RebalanceTokenModel

  @Prop({ required: true, type: BigInt })
  amountIn: bigint

  @Prop({ required: true, type: BigInt })
  amountOut: bigint

  @Prop({ required: true })
  slippage: number

  @Prop({ required: true, type: String })
  strategy: Strategy

  @Prop({ required: false })
  groupId?: string

  @Prop({ required: false, type: Object })
  context?: StrategyContext
}

export const RebalanceSchema = SchemaFactory.createForClass(RebalanceModel)
