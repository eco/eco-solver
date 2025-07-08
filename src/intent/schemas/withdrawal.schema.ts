import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { Hex } from 'viem'
import { WatchEventModel, WatchEventSchema } from './watch-event.schema'

@Schema({ timestamps: true })
export class WithdrawalModel extends Document {
  @Prop({
    required: false,
    type: WatchEventSchema,
    _id: false,
    default: undefined,
  })
  event?: WatchEventModel

  @Prop({ required: true, type: String })
  intentHash: Hex

  @Prop({ required: true, type: Types.ObjectId, ref: 'IntentSourceModel' })
  intentId: Types.ObjectId

  @Prop({ required: true, type: String })
  recipient: Hex

  @Prop({ required: false, type: Date })
  processedAt?: Date

  @Prop({ required: true, type: Date, default: Date.now })
  createdAt: Date

  @Prop({ required: true, type: Date, default: Date.now })
  updatedAt: Date
}

export const WithdrawalSchema = SchemaFactory.createForClass(WithdrawalModel)

// Indexes for efficient querying
WithdrawalSchema.index({ intentHash: 1 }, { unique: true })
WithdrawalSchema.index({ recipient: 1 }, { unique: false })
WithdrawalSchema.index({ intentId: 1 }, { unique: true })
WithdrawalSchema.index({ 'event.transactionHash': 1, 'event.logIndex': 1 }, { unique: true })
WithdrawalSchema.index({ 'event.sourceChainID': 1, 'event.sourceNetwork': 1 }, { unique: false })
WithdrawalSchema.index({ createdAt: -1 }, { unique: false })
