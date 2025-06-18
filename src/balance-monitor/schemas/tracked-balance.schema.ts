import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type TrackedBalanceDocument = TrackedBalance & Document

@Schema({
  collection: 'tracked-balances',
  timestamps: true,
})
export class TrackedBalance {
  @Prop({ required: true, type: Number })
  chainId: number

  @Prop({ required: true, type: String })
  tokenAddress: string

  @Prop({ required: true, type: String })
  balance: string // Store as string to handle BigInt

  @Prop({ type: Number })
  decimals?: number

  @Prop({ type: String })
  blockNumber?: string // For native tokens

  @Prop({ required: true, type: Date, default: Date.now })
  lastUpdated: Date

  @Prop({ type: String })
  transactionHash?: string // Last transaction that updated this balance
}

export const TrackedBalanceSchema = SchemaFactory.createForClass(TrackedBalance)

// Create indexes for efficient querying
TrackedBalanceSchema.index({ chainId: 1, tokenAddress: 1 }, { unique: true }) // Compound unique index
TrackedBalanceSchema.index({ chainId: 1 }) // Index for chain-specific queries
TrackedBalanceSchema.index({ lastUpdated: -1 }) // Index for time-based queries
