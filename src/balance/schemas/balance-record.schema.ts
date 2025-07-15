import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { Hex } from 'viem'

// Define a type for Hex address or 'native' to represent native gas token
export type HexNative = Hex | 'native'

@Schema({
  collection: 'balance_records',
  timestamps: true,
  versionKey: false,
})
export class BalanceRecord extends Document {
  @Prop({ required: true, type: String })
  chainId: string

  @Prop({ required: true, type: String })
  address: HexNative // Hex address or 'native'

  @Prop({ required: true, type: String })
  balance: string // Current balance from RPC (store as string to handle bigint)

  @Prop({ required: true, type: String })
  blockNumber: string // Block number when balance was fetched

  @Prop({ required: true, type: String })
  blockHash: string

  @Prop({ required: false, type: Number })
  decimals: number

  @Prop({ required: false, type: String })
  tokenSymbol: string

  @Prop({ required: false, type: String })
  tokenName: string
}

export const BalanceRecordSchema = SchemaFactory.createForClass(BalanceRecord)

// Unique index for chainId + address (one record per chain/token combination)
BalanceRecordSchema.index({ chainId: 1, address: 1 }, { unique: true })

// Additional indexes for efficient querying
BalanceRecordSchema.index({ chainId: 1 })
BalanceRecordSchema.index({ blockNumber: -1 })

export type BalanceRecordModel = BalanceRecord & Document
