import { Strategy } from '@/liquidity-manager/types/types'
import { RejectionReason } from '@/liquidity-manager/schemas/rebalance-quote-rejection.schema'
import { IntentExecutionTypeKeys } from '@/quote/enums/intent-execution-type.enum'

// Business Context Interfaces for Factory Methods
export interface IntentOperationLogParams {
  message: string
  intentHash: string
  quoteId?: string
  creator?: string
  prover?: string
  funder?: string
  inbox?: string
  dAppId?: string
  sourceChainId?: number
  destinationChainId?: number
  tokenInAddress?: string
  tokenOutAddress?: string
  amountIn?: string
  amountOut?: string
  nativeValue?: string
  deadline?: number
  intentExecutionType?: (typeof IntentExecutionTypeKeys)[number]
  operationType: 'creation' | 'fulfillment' | 'validation' | 'funding'
  status: 'started' | 'completed' | 'failed'
  properties?: object
}

export interface LiquidityOperationLogParams {
  message: string
  rebalanceId: string
  walletAddress: string
  strategy: Strategy
  sourceChainId?: number
  destinationChainId?: number
  tokenInAddress?: string
  tokenOutAddress?: string
  amountIn?: string
  amountOut?: string
  slippage?: number
  groupId?: string
  operationType: 'rebalancing' | 'liquidity_provision' | 'withdrawal' | 'quote_rejection'
  status: 'pending' | 'completed' | 'failed' | 'rejected'
  rejectionReason?: RejectionReason
  properties?: object
}

export interface QuoteGenerationLogParams {
  message: string
  quoteId: string
  intentHash?: string
  dAppId?: string
  sourceChainId?: number
  destinationChainId?: number
  tokenInAddress?: string
  tokenOutAddress?: string
  amountIn?: string
  amountOut?: string
  intentExecutionType?: (typeof IntentExecutionTypeKeys)[number]
  operationType: 'quote_generation' | 'quote_validation' | 'quote_rejection'
  status: 'started' | 'completed' | 'failed'
  properties?: object
}

export interface HealthOperationLogParams {
  message: string
  healthCheck: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  dependencies?: string[]
  properties?: object
}

export interface GenericOperationLogParams {
  message: string
  operationType: string
  status?: string
  duration?: number
  properties?: object
}

export interface PerformanceMetricLogParams {
  message: string
  operationType: string
  responseTimeMs: number
  queueDepth?: number
  cpuUsage?: number
  memoryUsage?: number
  activeConnections?: number
  properties?: object
}

// Context Interfaces for Wrapper Classes
export interface LiquidityManagerLogContext {
  rebalanceId: string
  walletAddress: string
  strategy: Strategy
  sourceChainId?: number
  destinationChainId?: number
  tokenInAddress?: string
  tokenOutAddress?: string
  groupId?: string
}

export interface IntentOperationLogContext {
  intentHash: string
  quoteId?: string
  creator?: string
  dAppId?: string
  sourceChainId?: number
  destinationChainId?: number
  operationType?: 'creation' | 'fulfillment' | 'validation' | 'funding'
}

export interface QuoteGenerationLogContext {
  quoteId: string
  intentHash?: string
  dAppId?: string
  sourceChainId?: number
  destinationChainId?: number
  tokenInAddress?: string
  tokenOutAddress?: string
  intentExecutionType?: (typeof IntentExecutionTypeKeys)[number]
}

export interface HealthOperationLogContext {
  healthCheck: string
  dependencies?: string[]
}

// Datadog Structure Interfaces
export interface DatadogLogStructure {
  '@timestamp': string
  message: string
  service: string
  status: 'debug' | 'info' | 'warn' | 'error'
  ddsource: string
  ddtags: string
  host?: string
  env?: string
  version?: string
  'logger.name'?: string
  trace_id?: string
  eco?: EcoBusinessContext
  operation?: OperationContext
  metrics?: MetricsContext
  error?: ErrorContext
  performance?: PerformanceContext
  [key: string]: any
}

export interface EcoBusinessContext {
  intent_hash?: string
  quote_id?: string
  rebalance_id?: string
  transaction_hash?: string
  request_id?: string
  wallet_address?: string
  creator?: string
  prover?: string
  funder?: string
  inbox?: string
  d_app_id?: string
  group_id?: string
  source_chain_id?: number
  destination_chain_id?: number
  strategy?: string
  intent_execution_type?: string
  rejection_reason?: string
}

export interface OperationContext {
  type: string
  status?: string
  duration_ms?: number
  retry_count?: number
  correlation_id?: string
}

export interface MetricsContext {
  amount_in?: string
  amount_out?: string
  native_value?: string
  swap_amount?: number
  slippage?: number
  deadline?: number
  current_balance?: number
  target_balance?: number
  token_in_address?: string
  token_out_address?: string
  fee_amount?: string
  gas_used?: number
  gas_price?: string
  execution_price?: string
}

export interface ErrorContext {
  kind: string
  message: string
  stack?: string
  code?: string | number
  recoverable?: boolean
  upstream_service?: string
  retry_after?: number
}

export interface PerformanceContext {
  response_time_ms: number
  queue_depth?: number
  cpu_usage?: number
  memory_usage?: number
  active_connections?: number
}

// Validation Constants
export const DATADOG_LIMITS = {
  MAX_ATTRIBUTES: 256,
  MAX_ATTRIBUTE_KEY_LENGTH: 50,
  MAX_NESTED_LEVELS: 20,
  MAX_ATTRIBUTE_VALUE_LENGTH: 1024, // For faceted fields
  MAX_LOG_SIZE: 25 * 1024, // 25KB in bytes
} as const

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
// Re-export commonly used types for convenience
export type { Strategy as StrategyType } from '@/liquidity-manager/types/types'
export type { RejectionReason } from '@/liquidity-manager/schemas/rebalance-quote-rejection.schema'
export type IntentExecutionTypeUnion = (typeof IntentExecutionTypeKeys)[number]
