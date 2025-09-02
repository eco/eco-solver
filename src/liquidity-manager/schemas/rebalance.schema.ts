import { plainToInstance } from 'class-transformer'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { RebalanceTokenModel } from './rebalance-token.schema'
import { Strategy, StrategyContext } from '@/liquidity-manager/types/types'

@Schema({ timestamps: true })
export class RebalanceModel {
  @Prop({ required: true })
  rebalanceJobID: string

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

  @Prop({ required: true, index: true })
  strategy: Strategy

  @Prop({ required: false })
  groupId?: string

  @Prop({ required: false, type: Object })
  context: StrategyContext

  @Prop({
    required: true,
    enum: RebalanceStatus.enumKeys,
<<<<<<< HEAD
    default: RebalanceStatus.COMPLETED.toString(),
=======
    default: RebalanceStatus.PENDING.toString(),
>>>>>>> ed00a4c9dbf61fd5fd6ed44f4db0231297eb2afc
  })
  status: string

  @Prop({ required: false })
  createdAt?: Date

  @Prop({ required: false })
  updatedAt?: Date

  getStatus?(): RebalanceStatus {
    return RebalanceStatus.fromString(this.status)!
  }

  static fromJSON(json: any): RebalanceModel {
    return json.getStatus ? json : plainToInstance(RebalanceModel, json)
  }
}

export const RebalanceSchema = SchemaFactory.createForClass(RebalanceModel)

// Define indexes
<<<<<<< HEAD
RebalanceSchema.index({ 'tokenIn.chainId': 1, 'tokenIn.tokenAddress': 1 })
RebalanceSchema.index({ 'tokenOut.chainId': 1, 'tokenOut.tokenAddress': 1 })
=======
>>>>>>> ed00a4c9dbf61fd5fd6ed44f4db0231297eb2afc
RebalanceSchema.index({ rebalanceJobID: 1 }, { unique: false })
RebalanceSchema.index({ wallet: 1 }, { unique: false })
RebalanceSchema.index({ status: 1 }, { unique: false })
RebalanceSchema.index({ createdAt: 1 }, { unique: false })
RebalanceSchema.index({ updatedAt: 1 }, { unique: false })
