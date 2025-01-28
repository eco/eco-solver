import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { WatchEventModel, WatchEventSchema } from './watch-event.schema'
import { IntentDataModel, IntentSourceDataSchema } from './intent-data.schema'
import { GetTransactionReceiptReturnType } from 'viem'
import { ValidationIntentModel } from '@/intent/validation.sevice'

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
}

export const IntentSourceSchema = SchemaFactory.createForClass(IntentSourceModel)

// Set collation options for case-insensitive search.
IntentSourceSchema.index({ status: 1 }, { unique: false })

/**
 * Converts an intent model to a validation intent model
 * @param model the intent model
 * @returns
 */
export function toValidationIntentModel(model: IntentSourceModel): ValidationIntentModel {
  return {
    route: model.intent.route,
    reward: model.intent.reward,
    hash: model.intent.hash,
  }
}
