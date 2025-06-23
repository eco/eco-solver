import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({
  collection: 'balance_records',
  timestamps: true,
  versionKey: false,
})
export class BalanceRecord extends Document {
  @Prop({ required: true, type: String })
  chainId: string // Store as string to handle bigint

  @Prop({ required: true, type: String })
  tokenAddress: string // Hex address or 'native'

  @Prop({ required: true, type: String })
  balance: string // Store as string to handle bigint

  @Prop({ required: true, type: String })
  blockNumber: string // Store as string to handle bigint

  @Prop({ required: true, type: String })
  blockHash: string // Hex hash

  @Prop({ required: true, type: Date })
  timestamp: Date

  @Prop({ required: false, type: String })
  transactionHash?: string // Optional Hex hash

  @Prop({ required: false, type: Number })
  decimals?: number

  @Prop({ required: false, type: String })
  tokenSymbol?: string

  @Prop({ required: false, type: String })
  tokenName?: string
}

export const BalanceRecordSchema = SchemaFactory.createForClass(BalanceRecord)

// Compound indexes for efficient querying
BalanceRecordSchema.index({ chainId: 1, tokenAddress: 1 })
BalanceRecordSchema.index({ chainId: 1, timestamp: -1 })
BalanceRecordSchema.index({ blockNumber: -1 })
BalanceRecordSchema.index({ timestamp: -1 })
BalanceRecordSchema.index({ transactionHash: 1 }, { sparse: true })

// Unique index to prevent duplicate balance records at same block
BalanceRecordSchema.index({ chainId: 1, tokenAddress: 1, blockNumber: 1 }, { unique: true })

export type BalanceRecordModel = BalanceRecord & Document
