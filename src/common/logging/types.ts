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
  deadline?: string
  salt?: string
  logIndex?: number
  routeTokens?: Array<{ token: string; amount: string }>
  rewardTokens?: Array<{ token: string; amount: string }>
  intentExecutionType?: (typeof IntentExecutionTypeKeys)[number]
  operationType: 'creation' | 'fulfillment' | 'validation' | 'funding'
  status: 'started' | 'completed' | 'failed'
  properties?: object
}

export interface QuoteRejectionDetails {
  error_code?: string
  error_category?: 'liquidity' | 'slippage' | 'balance' | 'provider' | 'validation' | 'network'
  provider_response?: string
  provider_error_code?: string
  slippage_calculated?: number
  max_slippage_allowed?: number
  quotes_attempted?: number
  fallback_attempted?: boolean
  retry_count?: number
  upstream_service?: string
  network_conditions?: {
    gas_price?: string
    network_congestion?: 'low' | 'medium' | 'high'
    estimated_confirmation_time_ms?: number
  }
  token_analysis?: {
    liquidity_depth?: string
    price_impact?: number
    volatility_warning?: boolean
  }
}

export interface LiquidityOperationLogParams {
  message: string
  rebalanceId: string
  walletAddress: string
  strategy: Strategy | string // Allow string for system operations
  sourceChainId?: number
  destinationChainId?: number
  tokenInAddress?: string
  tokenOutAddress?: string
  amountIn?: string
  amountOut?: string
  slippage?: number
  groupId?: string
  rebalanceJobId?: string
  currentBalanceIn?: string
  targetBalanceIn?: string
  currentBalanceOut?: string
  targetBalanceOut?: string
  tokenInDecimals?: number
  tokenOutDecimals?: number
  operationType: 'rebalancing' | 'liquidity_provision' | 'withdrawal' | 'quote_rejection'
  status: 'pending' | 'completed' | 'failed' | 'rejected'
  rejectionReason?: RejectionReason
  rejectionDetails?: QuoteRejectionDetails
  properties?: object
}

export interface QuoteReceiptAnalysis {
  transaction_hash?: string
  block_number?: number
  block_hash?: string
  gas_used?: number
  gas_price?: string
  effective_gas_price?: string
  cumulative_gas_used?: number
  status: 'success' | 'failed' | 'reverted'
  event_count?: number
  events?: Array<{
    event_name: string
    contract_address: string
    topics_count: number
  }>
  confirmation_time_ms?: number
  receipt_size_bytes?: number
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
  receipt?: string
  receiptAnalysis?: QuoteReceiptAnalysis
  intentExecutionType?: (typeof IntentExecutionTypeKeys)[number] | string
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

export interface TransactionOperationLogParams {
  message: string
  transactionHash?: string
  walletAddress?: string
  chainId?: number
  gasUsed?: number
  gasPrice?: string
  operationType:
    | 'transaction_send'
    | 'transaction_confirm'
    | 'signature_generation'
    | 'wallet_operation'
    | 'smart_wallet_deploy'
  status: 'pending' | 'completed' | 'failed' | 'signed'
  blockNumber?: number
  nonce?: number
  value?: string
  to?: string
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
  strategy: Strategy | string // Allow string for system operations like 'check-balances', 'system', etc.
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
  status?: 'started' | 'completed' | 'failed'
}

export interface QuoteGenerationLogContext {
  quoteId: string
  intentHash?: string
  dAppId?: string
  sourceChainId?: number
  destinationChainId?: number
  tokenInAddress?: string
  tokenOutAddress?: string
  intentExecutionType?: (typeof IntentExecutionTypeKeys)[number] | string
  operationType?: 'quote_generation' | 'quote_validation' | 'quote_rejection'
  status?: 'started' | 'completed' | 'failed'
}

export interface HealthOperationLogContext {
  healthCheck: string
  status?:
    | 'healthy'
    | 'unhealthy'
    | 'degraded'
    | 'started'
    | 'warning'
    | 'error'
    | 'ok'
    | 'shutting_down'
  responseTime?: number
  dependencies?: string[]
}

export interface GenericOperationLogContext {
  operationType?: string
  status?: string
  duration?: number
}

export interface TransactionOperationLogContext {
  transactionHash?: string
  walletAddress?: string
  chainId?: number
  operationType?:
    | 'transaction_send'
    | 'transaction_confirm'
    | 'signature_generation'
    | 'wallet_operation'
    | 'smart_wallet_deploy'
  status?: 'pending' | 'completed' | 'failed' | 'signed'
  blockNumber?: number
  nonce?: number
  value?: string
  to?: string
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

export interface LifecycleTimestamps {
  created_at?: string
  updated_at?: string
  started_at?: string
  completed_at?: string
  failed_at?: string
  last_status_change?: string
  first_seen?: string
  last_seen?: string
  processing_started?: string
  processing_completed?: string
  validation_completed?: string
  execution_started?: string
  execution_completed?: string
}

export interface EcoBusinessContext {
  intent_hash?: string
  intent_hash_full?: string // Full value for high-cardinality optimization
  quote_id?: string
  quote_id_full?: string // Full value for high-cardinality optimization
  rebalance_id?: string
  rebalance_id_full?: string // Full value for high-cardinality optimization
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
  // New schema fields for complete coverage
  salt?: string
  log_index?: number
  deadline?: string
  rebalance_job_id?: string
  receipt?: string
  token_in_address?: string
  token_out_address?: string
  amount_in?: string
  amount_out?: string
  current_balance_in?: string
  target_balance_in?: string
  current_balance_out?: string
  target_balance_out?: string
  token_in_decimals?: number
  token_out_decimals?: number
  // Lifecycle timestamp tracking
  lifecycle_timestamps?: LifecycleTimestamps
  // Chain sync specific fields
  sync_type?:
    | 'intent_created'
    | 'intent_funded'
    | 'application_bootstrap'
    | 'sync_transactions'
    | 'missing_transactions'

  // APM trace correlation fields
  trace_id?: string
  span_id?: string
  parent_id?: string
  service_name?: string

  // Event tracking fields
  event_type?: string
  chain_sync_status?: 'started' | 'completed' | 'failed' | 'no_transactions_found'

  // Smart wallet specific fields
  contract_address?: string
  token_address?: string
  source_network?: string
  source_address?: string
  from_block?: string
  to_block?: string
  event_count?: number
  max_block_range?: string
  block_number?: number
}

export interface OperationContext {
  type: string
  status?: string
  duration_ms?: number
  retry_count?: number
  correlation_id?: string
  apm_operation?: string // APM operation name for trace correlation
}

export interface MetricsContext {
  amount_in?: string
  amount_out?: string
  native_value?: string
  swap_amount?: number
  slippage?: number
  deadline?: string
  current_balance?: number
  target_balance?: number
  token_in_address?: string
  token_out_address?: string
  fee_amount?: string
  gas_used?: number
  gas_price?: string
  execution_price?: string
  block_number?: number
  nonce?: number
  transaction_value?: string
}

export interface ErrorContext {
  kind: string
  message: string
  stack?: string
  code?: string | number
  recoverable?: boolean
  upstream_service?: string
  retry_after?: number
  fingerprint?: string
}

export interface PerformanceContext {
  response_time_ms: number
  queue_depth?: number
  cpu_usage?: number
  memory_usage?: number
  active_connections?: number
  // Chain sync specific performance metrics
  events_per_second?: number
  blocks_per_second?: number
  block_range_processed?: number
  throughput_efficiency?: number
  // Logging performance tracking
  logging_overhead_ms?: number
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
