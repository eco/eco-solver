import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { GetTransactionReceiptReturnType } from 'viem'
import { WatchEventModel, WatchEventSchema, IntentDataModel, IntentSourceDataSchema } from '@libs/database'

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
