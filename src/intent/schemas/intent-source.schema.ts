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
  @Prop({
    required: false,
    type: WatchEventSchema,
    _id: false,
    default: undefined,
  })
  event?: WatchEventModel

  @Prop({ required: true, type: IntentSourceDataSchema })
  intent: IntentDataModel

  @Prop({ type: Object })
  receipt: GetTransactionReceiptReturnType

  @Prop({ required: true, type: String })
  status: IntentSourceStatus

  static getSource(intentSourceModel: IntentSourceModel): bigint {
    return intentSourceModel.intent.route.source
  }
}

export const IntentSourceSchema = SchemaFactory.createForClass(IntentSourceModel)

// Set collation options for case-insensitive search.
IntentSourceSchema.index({ status: 1 }, { unique: false })

// Use partial index to avoid creating index for documents without event.transactionHash (gasless intents)
IntentSourceSchema.index(
  { 'event.transactionHash': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'event.transactionHash': { $exists: true },
    },
  },
)

// IntentSourceSchema.index({ 'event.transactionHash': 1 }, { unique: true, sparse: true })
