/**
 * Analytics event constants for the eco-solver application.
 * Centralizes all event names to ensure consistency and prevent typos.
 */

// ========== INTENT MODULE EVENTS ==========
export const INTENT_EVENTS = {
  // Intent Creation
  DUPLICATE_DETECTED: 'intent_duplicate_detected',
  CREATED_AND_QUEUED: 'intent_created_and_queued',
  CREATED_WALLET_REJECTED: 'intent_created_wallet_rejected',
  CREATION_STARTED: 'intent_creation_started',
  CREATION_FAILED: 'intent_creation_failed',

  // Gasless Intent Creation
  GASLESS_CREATED: 'gasless_intent_created',
  GASLESS_CREATION_STARTED: 'gasless_intent_creation_started',
  GASLESS_CREATION_FAILED: 'gasless_intent_creation_failed',

  // Intent Validation
  VALIDATION_STARTED: 'intent_validation_started',
  VALIDATION_FAILED: 'intent_validation_failed',
  VALIDATION_CHECKS_PASSED: 'intent_validation_checks_passed',
  VALIDATED_AND_QUEUED: 'intent_validated_and_queued',

  // Intent Funding
  FUNDING_CHECK_STARTED: 'intent_funding_check_started',
  FUNDING_CHECK_RETRY: 'intent_funding_check_retry',
  FUNDING_VERIFIED: 'intent_funding_verified',
  FUNDING_CHECK_FAILED: 'intent_funding_check_failed',

  // Intent Feasibility
  FEASIBILITY_CHECK_STARTED: 'intent_feasibility_check_started',
  FEASIBILITY_CHECK_SUCCESS: 'intent_feasibility_check_success',
  FEASIBILITY_CHECK_FAILED: 'intent_feasibility_check_failed',
  FEASIBLE_AND_QUEUED: 'intent_feasible_and_queued',
  INFEASIBLE: 'intent_infeasible',

  // Intent Fulfillment
  FULFILLMENT_STARTED: 'intent_fulfillment_started',
  FULFILLMENT_SUCCESS: 'intent_fulfillment_success',
  FULFILLMENT_FAILED: 'intent_fulfillment_failed',
  FULFILLMENT_SKIPPED: 'intent_fulfillment_skipped',
  FULFILLMENT_METHOD_SELECTED: 'intent_fulfillment_method_selected',
  FULFILLMENT_TRANSACTION_REVERTED: 'intent_fulfillment_transaction_reverted',

  // Wallet Fulfillment
  WALLET_FULFILLMENT_SUCCESS: 'wallet_fulfillment_success',
  WALLET_FULFILLMENT_FAILED: 'wallet_fulfillment_failed',
  WALLET_FULFILLMENT_TRANSACTION_REVERTED: 'wallet_fulfillment_transaction_reverted',

  // ERC20 Transaction Handling
  ERC20_TRANSACTION_HANDLING_SUCCESS: 'erc20_transaction_handling_success',
  ERC20_TRANSACTION_HANDLING_UNSUPPORTED: 'erc20_transaction_handling_unsupported',

  // Transaction Target Generation
  TRANSACTION_TARGET_GENERATION_SUCCESS: 'transaction_target_generation_success',
  TRANSACTION_TARGET_GENERATION_ERROR: 'transaction_target_generation_error',
  TRANSACTION_TARGET_UNSUPPORTED_CONTRACT_TYPE: 'transaction_target_unsupported_contract_type',

  // Fulfill Intent Transaction Creation
  FULFILL_INTENT_TX_CREATION_SUCCESS: 'fulfill_intent_tx_creation_success',
  FULFILL_INTENT_TX_CREATION_FAILED: 'fulfill_intent_tx_creation_failed',

  // Intent Status Updates
  INTENT_STATUS_UPDATE: 'intent_status_update',

  // Fulfillment Processing
  FULFILLMENT_PROCESSING_SUCCESS: 'fulfillment_processing_success',
  FULFILLMENT_PROCESSING_ERROR: 'fulfillment_processing_error',
  FULFILLMENT_PROCESSING_INTENT_NOT_FOUND: 'fulfillment_processing_intent_not_found',

  // Intent Process Data Retrieval
  INTENT_PROCESS_DATA_RETRIEVAL_SUCCESS: 'intent_process_data_retrieval_success',
  INTENT_PROCESS_DATA_RETRIEVAL_ERROR: 'intent_process_data_retrieval_error',
  INTENT_PROCESS_DATA_RETRIEVAL_MODEL_NOT_FOUND: 'intent_process_data_retrieval_model_not_found',
  INTENT_PROCESS_DATA_RETRIEVAL_SOLVER_NOT_FOUND: 'intent_process_data_retrieval_solver_not_found',

  // Solver Resolution
  SOLVER_RESOLUTION_SUCCESS: 'solver_resolution_success',
  SOLVER_RESOLUTION_NOT_FOUND: 'solver_resolution_not_found',

  // Intent Retrieval
  INTENT_RETRIEVAL_SUCCESS: 'intent_retrieval_success',
  INTENT_RETRIEVAL_ERROR: 'intent_retrieval_error',
  INTENT_RETRIEVAL_NOT_FOUND: 'intent_retrieval_not_found',

  // Crowd Liquidity
  CROWD_LIQUIDITY_ROUTE_CHECK: 'intent_crowd_liquidity_route_check',
  CROWD_LIQUIDITY_FULFILLMENT_STARTED: 'intent_crowd_liquidity_fulfillment_started',
  CROWD_LIQUIDITY_FULFILLMENT_SUCCEEDED: 'intent_crowd_liquidity_fulfillment_succeeded',
  CROWD_LIQUIDITY_FULFILLMENT_FAILED: 'intent_crowd_liquidity_fulfillment_failed',
  CROWD_LIQUIDITY_FULFILLMENT_SUCCESS: 'crowd_liquidity_fulfillment_success',
  CROWD_LIQUIDITY_FULFILLMENT_REWARD_NOT_ENOUGH: 'crowd_liquidity_fulfillment_reward_not_enough',
  CROWD_LIQUIDITY_FULFILLMENT_POOL_NOT_SOLVENT: 'crowd_liquidity_fulfillment_pool_not_solvent',
  CROWD_LIQUIDITY_REBALANCE_SUCCESS: 'crowd_liquidity_rebalance_success',
  CROWD_LIQUIDITY_REBALANCE_ERROR: 'crowd_liquidity_rebalance_error',
  CROWD_LIQUIDITY_ROUTE_SUPPORT_CHECK: 'crowd_liquidity_route_support_check',
  CROWD_LIQUIDITY_ROUTE_SUPPORT_RESULT: 'crowd_liquidity_route_support_result',
  CROWD_LIQUIDITY_REWARD_CHECK: 'crowd_liquidity_reward_check',
  CROWD_LIQUIDITY_REWARD_CHECK_RESULT: 'crowd_liquidity_reward_check_result',
  CROWD_LIQUIDITY_POOL_SOLVENCY_CHECK: 'crowd_liquidity_pool_solvency_check',
  CROWD_LIQUIDITY_POOL_SOLVENCY_RESULT: 'crowd_liquidity_pool_solvency_result',
  CROWD_LIQUIDITY_POOL_SOLVENCY_ERROR: 'crowd_liquidity_pool_solvency_error',
  CROWD_LIQUIDITY_LIT_ACTION_SUCCESS: 'crowd_liquidity_lit_action_success',
  CROWD_LIQUIDITY_LIT_ACTION_ERROR: 'crowd_liquidity_lit_action_error',
  WALLET_FULFILLMENT_FALLBACK: 'intent_wallet_fulfillment_fallback',
} as const

// ========== QUOTE MODULE EVENTS ==========
export const QUOTE_EVENTS = {
  // Quote Requests
  REQUEST_RECEIVED: 'quote_request_received',
  REVERSE_REQUEST_RECEIVED: 'reverse_quote_request_received',

  // Quote Responses
  RESPONSE_SUCCESS: 'quote_response_success',
  RESPONSE_ERROR: 'quote_response_error',
  REVERSE_RESPONSE_SUCCESS: 'reverse_quote_response_success',
  REVERSE_RESPONSE_ERROR: 'reverse_quote_response_error',

  // Quote V2 Events (V2 uses reverse quote logic)
  V2_REQUEST_RECEIVED: 'quote_v2_request_received',
  V2_RESPONSE_SUCCESS: 'quote_v2_response_success',
  V2_RESPONSE_ERROR: 'quote_v2_response_error',
  V2_TRANSFORM_ERROR: 'quote_v2_transform_error',

  // Quote Processing
  PROCESSING_STARTED: 'quote_processing_started',
  PROCESSING_SUCCESS: 'quote_processing_success',
  PROCESSING_FAILED_ALL: 'quote_processing_failed_all',

  // Quote Storage
  STORAGE_SUCCESS: 'quote_storage_success',
  STORAGE_FAILED: 'quote_storage_failed',

  // Quote Validation
  VALIDATION_STARTED: 'quote_validation_started',
  VALIDATION_SUCCESS: 'quote_validation_success',
  VALIDATION_FAILED: 'quote_validation_failed',

  // Quote Generation
  GENERATION_STARTED: 'quote_generation_started',
  GENERATION_SUCCESS: 'quote_generation_success',
  GENERATION_FAILED: 'quote_generation_failed',

  // Quote Database Operations
  DATABASE_STORE_SUCCESS: 'quote_database_store_success',
  DATABASE_STORE_ERROR: 'quote_database_store_error',

  // Quote Feasibility Check
  FEASIBILITY_CHECK_SUCCESS: 'quote_feasibility_check_success',
  FEASIBILITY_CHECK_ERROR: 'quote_feasibility_check_error',
} as const

// ========== WATCH MODULE EVENTS ==========
export const WATCH_EVENTS = {
  // Watch Create Intent
  CREATE_INTENT_SUBSCRIPTION_STARTED: 'watch_create_intent_subscription_started',
  CREATE_INTENT_SUBSCRIPTION_SUCCESS: 'watch_create_intent_subscription_success',
  CREATE_INTENT_SUBSCRIPTION_FAILED: 'watch_create_intent_subscription_failed',
  CREATE_INTENT_EVENTS_DETECTED: 'watch_create_intent_events_detected',
  CREATE_INTENT_JOB_QUEUED: 'watch_create_intent_job_queued',
  CREATE_INTENT_JOB_QUEUE_FAILED: 'watch_create_intent_job_queue_failed',

  // Watch Intent Funded
  INTENT_FUNDED_EVENTS_DETECTED: 'watch_intent_funded_events_detected',
  INTENT_FUNDED_JOB_QUEUED: 'watch_intent_funded_job_queued',
  INTENT_FUNDED_JOB_QUEUE_FAILED: 'watch_intent_funded_job_queue_failed',

  // Watch Fulfillment
  FULFILLMENT_EVENTS_DETECTED: 'watch_fulfillment_events_detected',
  FULFILLMENT_JOB_QUEUED: 'watch_fulfillment_job_queued',
  FULFILLMENT_JOB_QUEUE_FAILED: 'watch_fulfillment_job_queue_failed',

  // Watch Error Events
  WATCH_ERROR_OCCURRED: 'watch_error_occurred',
  WATCH_ERROR_RECOVERY_STARTED: 'watch_error_recovery_started',
  WATCH_ERROR_RECOVERY_SUCCESS: 'watch_error_recovery_success',
  WATCH_ERROR_RECOVERY_FAILED: 'watch_error_recovery_failed',

  // Watch Event Service Errors
  UNSUBSCRIBE_ERROR: 'watch_event_unsubscribe_error',
  UNSUBSCRIBE_FROM_ERROR: 'watch_event_unsubscribe_from_error',
} as const

// ========== BALANCE MODULE EVENTS ==========
export const BALANCE_EVENTS = {
  FETCH_SUCCESS: 'balance_fetch_success',
  FETCH_FAILED: 'balance_fetch_failed',
  UPDATE_BALANCE: 'balance_update',
  LOAD_TOKEN_BALANCE: 'balance_load_token_balance',
  NATIVE_BALANCE_FETCH: 'balance_native_fetch',
} as const

// ========== LIQUIDITY MANAGER MODULE EVENTS ==========
export const LIQUIDITY_MANAGER_EVENTS = {
  // Liquidity Provider Errors
  STRATEGY_QUOTE_ERROR: 'liquidity_strategy_quote_error',
  QUOTE_ROUTE_ERROR: 'liquidity_quote_route_error',
  FALLBACK_ROUTE_ERROR: 'liquidity_fallback_route_error',

  // CCTP LiFi Provider Errors
  CCTP_LIFI_EXECUTION_ERROR: 'liquidity_cctp_lifi_execution_error',
  CCTP_LIFI_ROUTE_CONTEXT_ERROR: 'liquidity_cctp_lifi_route_context_error',
  CCTP_LIFI_SOURCE_SWAP_ERROR: 'liquidity_cctp_lifi_source_swap_error',
  CCTP_LIFI_BRIDGE_ERROR: 'liquidity_cctp_lifi_bridge_error',

  // LiFi Provider Errors
  LIFI_CACHE_INIT_ERROR: 'liquidity_lifi_cache_init_error',
  LIFI_CORE_TOKEN_ROUTE_ERROR: 'liquidity_lifi_core_token_route_error',
} as const

// ========== HEALTH MODULE EVENTS ==========
export const HEALTH_EVENTS = {
  CHECK_REQUEST: 'health_check_request',
  CHECK_SUCCESS: 'health_check_success',
  CHECK_ERROR: 'health_check_error',
} as const

// ========== JOB MODULE EVENTS ==========
export const JOB_EVENTS = {
  STARTED: 'job_started',
  COMPLETED: 'job_completed',
  FAILED: 'job_failed',
} as const

// ========== ERROR EVENT CONSTANTS ==========
export const ERROR_EVENTS = {
  // Intent Error Events
  GASLESS_CREATION_FAILED: 'gasless_intent_creation_failed',
  INTENT_FEASIBILITY_CHECK_FAILED: 'intent_feasibility_check_failed',
  INTENT_FULFILLMENT_FAILED: 'intent_fulfillment_failed',
  INTENT_FUNDING_CHECK_FAILED: 'intent_funding_check_failed',

  // Watch Error Events
  CREATE_INTENT_JOB_QUEUE_FAILED: 'watch_create_intent_job_queue_failed',
  INTENT_FUNDED_JOB_QUEUE_FAILED: 'watch_intent_funded_job_queue_failed',
  FULFILLMENT_JOB_QUEUE_FAILED: 'watch_fulfillment_job_queue_failed',

  // General Watch Error Events
  WATCH_CREATE_INTENT_SUBSCRIPTION_FAILED: 'watch_create_intent_subscription_failed',
  WATCH_INTENT_FUNDED_DB_ERROR: 'watch_intent_funded_db_error',
} as const

// ========== COMMON EVENT PATTERNS ==========
export const COMMON_EVENTS = {
  STARTED: '_started',
  SUCCESS: '_success',
  FAILED: '_failed',
  COMPLETED: '_completed',
  RETRY: '_retry',
  SKIPPED: '_skipped',
} as const

// ========== ALL EVENTS EXPORT ==========
export const ANALYTICS_EVENTS = {
  INTENT: INTENT_EVENTS,
  QUOTE: QUOTE_EVENTS,
  WATCH: WATCH_EVENTS,
  BALANCE: BALANCE_EVENTS,
  LIQUIDITY_MANAGER: LIQUIDITY_MANAGER_EVENTS,
  HEALTH: HEALTH_EVENTS,
  JOB: JOB_EVENTS,
  ERROR: ERROR_EVENTS,
  COMMON: COMMON_EVENTS,
} as const

// Type definitions for better TypeScript support
export type IntentEventName = (typeof INTENT_EVENTS)[keyof typeof INTENT_EVENTS]
export type QuoteEventName = (typeof QUOTE_EVENTS)[keyof typeof QUOTE_EVENTS]
export type WatchEventName = (typeof WATCH_EVENTS)[keyof typeof WATCH_EVENTS]
export type AnalyticsEventName = IntentEventName | QuoteEventName | WatchEventName
