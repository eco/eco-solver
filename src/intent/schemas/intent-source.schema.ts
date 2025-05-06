import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { WatchEventModel, WatchEventSchema } from './watch-event.schema'
import { IntentDataModel, IntentSourceDataSchema } from './intent-data.schema'
import { GetTransactionReceiptReturnType } from 'viem'

export type IntentSourceStatus =
  | 'PENDING'
  | 'SOLVED'
  | 'EXPIRED'
  | 'FAILED'
  | 'INVALID'
  | 'INFEASABLE'
  | 'NON-BEND-WALLET'

@Schema({ timestamps: true })
export class IntentSourceModel {
  @Prop({ required: true, type: WatchEventSchema })
  event: WatchEventModel

  @Prop({ required: true, type: IntentSourceDataSchema })
  intent: IntentDataModel

  @Prop({ type: Object })
  receipt: GetTransactionReceiptReturnType

  @Prop({ required: true, type: String })
  status: IntentSourceStatus

  @Prop({ required: true, default: 'EVM' })
  chain: 'EVM' | 'SVM'
}

export const IntentSourceSchema = SchemaFactory.createForClass(IntentSourceModel)

// Set collation options for case-insensitive search.
IntentSourceSchema.index({ status: 1 }, { unique: false })
