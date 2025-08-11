@Schema({ timestamps: true })
export class RebalanceModel {
  @Prop({ required: false })
  wallet?: string

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
  strategy: Strategy

  @Prop({ required: false })
  groupId?: string

  @Prop({ required: false, type: Object })
  context: StrategyContext
}

export const RebalanceSchema = SchemaFactory.createForClass(RebalanceModel)
