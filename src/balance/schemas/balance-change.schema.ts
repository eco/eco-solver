import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { Hex } from 'viem'

@Schema({
  collection: 'balance_changes',
  timestamps: true,
  versionKey: false,
})
export class BalanceChange extends Document {
  @Prop({ required: true, type: String })
  chainId: string

  @Prop({ required: true, type: String })
  address: Hex | 'native' // Links to BalanceRecord by chainId + address

  @Prop({ required: true, type: String })
  changeAmount: string // Amount of the balance change

  @Prop({ required: true, type: String, enum: ['incoming', 'outgoing'] })
  direction: 'incoming' | 'outgoing'

  @Prop({ required: true, type: String })
  blockNumber: string

  @Prop({ required: true, type: String })
  blockHash: string

  @Prop({ required: true, type: String })
  transactionHash: string

  @Prop({ required: false, type: String })
  from?: string

  @Prop({ required: false, type: String })
  to?: string
}

export const BalanceChangeSchema = SchemaFactory.createForClass(BalanceChange)

// Index for linking to BalanceRecord
BalanceChangeSchema.index({ chainId: 1, address: 1 })

// Index for querying by block number
BalanceChangeSchema.index({ blockNumber: 1 })

// Compound index for efficient queries
BalanceChangeSchema.index({ chainId: 1, address: 1, blockNumber: 1 })

export type BalanceChangeModel = BalanceChange & Document
