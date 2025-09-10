import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { RebalanceTokenModel } from './rebalance-token.schema'
import { Strategy } from '@/liquidity-manager/types/types'

/**
 * Enumeration of possible reasons why a rebalance quote was rejected.
 * This helps categorize failures for analytics and monitoring purposes.
 */
export enum RejectionReason {
  /** Quote rejected due to slippage exceeding acceptable thresholds */
  HIGH_SLIPPAGE = 'HIGH_SLIPPAGE',
  /** Quote rejected due to provider-side errors (API failures, timeouts, etc.) */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** Quote rejected due to insufficient liquidity for the requested swap */
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  /** Quote rejected due to request timeout */
  TIMEOUT = 'TIMEOUT',
}

/**
 * MongoDB schema for persisting rejected rebalance quotes.
 * This collection enables systematic analysis of quote failures, provider performance,
 * and route optimization by storing detailed rejection data.
 *
 * Collection name: rebalancequoterejectionmodels
 */
@Schema({ timestamps: true })
export class RebalanceQuoteRejectionModel {
  /** Unique identifier for the rebalance operation that was rejected */
  @Prop({ required: true })
  rebalanceId: string

  /** Strategy that generated this quote (LiFi, Stargate, CCTP, etc.) */
  @Prop({ required: true })
  strategy: Strategy

  /** Categorized reason for rejection (helps with analytics and monitoring) */
  @Prop({ required: true })
  reason: RejectionReason

  /** Source token information (chain, address, balances) */
  @Prop({ required: true })
  tokenIn: RebalanceTokenModel

  /** Destination token information (chain, address, balances) */
  @Prop({ required: true })
  tokenOut: RebalanceTokenModel

  /** Amount being swapped (normalized to decimal number) */
  @Prop({ required: true })
  swapAmount: number

  /**
   * Flexible object containing additional context about the rejection.
   * Examples:
   * - For HIGH_SLIPPAGE: { slippage: 15, quotes: [...] }
   * - For PROVIDER_ERROR: { error: "...", code: "...", stack: "..." }
   */
  @Prop({ required: false, type: Object })
  details?: any

  /** Optional wallet address associated with this rejection */
  @Prop({ required: false })
  walletAddress?: string
}

export const RebalanceQuoteRejectionSchema = SchemaFactory.createForClass(
  RebalanceQuoteRejectionModel,
)

/*
 * Strategic indexes for optimal query performance:
 *
 * 1. { rebalanceId: 1 } - Fast lookups for specific rebalance operations
 * 2. { strategy: 1, reason: 1 } - Analytics queries grouping by provider and failure type
 * 3. { tokenIn.chainId: 1, tokenOut.chainId: 1 } - Cross-chain route analysis
 * 4. { createdAt: -1 } - Time-based queries for health monitoring and recent failures
 */
RebalanceQuoteRejectionSchema.index({ rebalanceId: 1 })
RebalanceQuoteRejectionSchema.index({ strategy: 1, reason: 1 })
RebalanceQuoteRejectionSchema.index({ 'tokenIn.chainId': 1, 'tokenOut.chainId': 1 })
RebalanceQuoteRejectionSchema.index({ createdAt: -1 })
