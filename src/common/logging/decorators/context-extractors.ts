import { ExtractedContext, ContextExtractor, EntityTypeGuards } from './types'

/**
 * Entity type guards for identifying domain objects
 */
export const entityTypeGuards: EntityTypeGuards = {
  isRebalance: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      'rebalanceJobID' in entity &&
      'tokenIn' in entity &&
      'tokenOut' in entity &&
      'amountIn' in entity &&
      'amountOut' in entity
    )
  },

  isIntent: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      'hash' in entity &&
      'route' in entity &&
      'reward' in entity &&
      (entity.route?.creator || entity.route?.prover)
    )
  },

  isQuote: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      'quoteID' in entity &&
      'dAppID' in entity &&
      'intentExecutionType' in entity
    )
  },

  isWallet: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      ('address' in entity || 'walletAddress' in entity) &&
      (typeof entity.address === 'string' || typeof entity.walletAddress === 'string')
    )
  },

  isTransaction: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      ('txHash' in entity || 'transactionHash' in entity || 'hash' in entity) &&
      ('gasUsed' in entity || 'gasPrice' in entity || 'blockNumber' in entity)
    )
  },

  isRebalanceJobData: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      'rebalanceJobID' in entity &&
      'walletAddress' in entity &&
      'rebalance' in entity &&
      'network' in entity
    )
  },

  isRebalanceRequest: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      'quotes' in entity &&
      'token' in entity &&
      Array.isArray(entity.quotes)
    )
  },

  isIntentSourceModel: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      'intent' in entity &&
      'status' in entity &&
      entity.intent &&
      'hash' in entity.intent &&
      'route' in entity.intent &&
      'reward' in entity.intent
    )
  },

  isTokenData: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      'config' in entity &&
      entity.config &&
      'address' in entity.config &&
      'chainId' in entity.config
    )
  },

  isValidationChecks: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      'supportedProver' in entity &&
      'supportedNative' in entity &&
      'supportedTargets' in entity
    )
  },

  isGaslessIntentRequest: (entity: any): boolean => {
    return (
      entity &&
      typeof entity === 'object' &&
      'dAppID' in entity &&
      ('route' in entity || 'reward' in entity)
    )
  },
}

/**
 * Context extractor for Rebalance entities
 * Maps RebalanceModel fields to Datadog-optimized structure
 */
export const extractRebalanceContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isRebalance(entity)) {
    return {}
  }

  return {
    eco: {
      rebalance_id: entity.rebalanceJobID,
      rebalance_job_id: entity.rebalanceJobID, // Explicit field for new schema alignment
      wallet_address: entity.wallet,
      strategy: entity.strategy,
      source_chain_id: entity.tokenIn?.chainId,
      destination_chain_id: entity.tokenOut?.chainId,
      group_id: entity.groupId,
      token_in_address: entity.tokenIn?.tokenAddress,
      token_out_address: entity.tokenOut?.tokenAddress,
      amount_in: entity.amountIn?.toString(),
      amount_out: entity.amountOut?.toString(),
      // Token balance information for complete schema coverage
      current_balance_in: entity.tokenIn?.currentBalance?.toString(),
      target_balance_in: entity.tokenIn?.targetBalance?.toString(),
      current_balance_out: entity.tokenOut?.currentBalance?.toString(),
      target_balance_out: entity.tokenOut?.targetBalance?.toString(),
      token_in_decimals: entity.tokenIn?.decimals,
      token_out_decimals: entity.tokenOut?.decimals,
    },
    metrics: {
      token_in_address: entity.tokenIn?.tokenAddress,
      token_out_address: entity.tokenOut?.tokenAddress,
      amount_in: entity.amountIn?.toString(),
      amount_out: entity.amountOut?.toString(),
      slippage: entity.slippage,
      current_balance_in: entity.tokenIn?.currentBalance?.toString(),
      target_balance_in: entity.tokenIn?.targetBalance?.toString(),
      current_balance_out: entity.tokenOut?.currentBalance?.toString(),
      target_balance_out: entity.tokenOut?.targetBalance?.toString(),
    },
    operation: {
      status: entity.status,
      created_at: entity.createdAt?.toISOString(),
      updated_at: entity.updatedAt?.toISOString(),
    },
  }
}

/**
 * Helper function to detect if an object is a transaction receipt
 */
function isTransactionReceipt(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    ('transactionHash' in obj || 'hash' in obj) &&
    'blockNumber' in obj &&
    'status' in obj
  )
}

/**
 * Helper function to detect if an object is a validation checks object
 */
function isValidationChecks(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    'supportedProver' in obj &&
    'supportedNative' in obj &&
    'supportedTargets' in obj
  )
}

/**
 * Helper function to detect if an object is an error
 */
function isErrorObject(obj: any): boolean {
  return (
    obj &&
    (obj instanceof Error || (typeof obj === 'object' && ('message' in obj || 'name' in obj)))
  )
}

/**
 * Helper function to extract receipt data from various receipt types
 */
function extractReceiptData(receipt: any): any {
  if (!receipt) return {}

  // Handle nested receipt structure {previous: ..., current: ...}
  if (receipt.previous || receipt.current) {
    const result: any = {}

    // Extract from current error
    if (receipt.current && isErrorObject(receipt.current)) {
      result.current_error = {
        type: receipt.current.name || receipt.current.constructor?.name || 'Error',
        message: receipt.current.message,
      }
    }

    // Extract from previous receipt (if it's a transaction receipt)
    if (receipt.previous && isTransactionReceipt(receipt.previous)) {
      result.previous_transaction = {
        hash: receipt.previous.transactionHash || receipt.previous.hash,
        block_number: receipt.previous.blockNumber?.toString(),
        gas_used: receipt.previous.gasUsed?.toString(),
        status: receipt.previous.status,
      }
    }

    return result
  }

  // Handle transaction receipt
  if (isTransactionReceipt(receipt)) {
    return {
      transaction_hash: receipt.transactionHash || receipt.hash,
      block_number: receipt.blockNumber?.toString(),
      block_hash: receipt.blockHash,
      gas_used: receipt.gasUsed?.toString(),
      gas_price: receipt.gasPrice?.toString() || receipt.effectiveGasPrice?.toString(),
      cumulative_gas_used: receipt.cumulativeGasUsed?.toString(),
      transaction_index: receipt.transactionIndex?.toString(),
      transaction_status: receipt.status,
      logs_count: receipt.logs?.length || 0,
    }
  }

  // Handle validation checks object
  if (isValidationChecks(receipt)) {
    return {
      validation_failure: true,
      failed_checks: Object.entries(receipt)
        .filter(([, value]) => value === false)
        .map(([key]) => key),
      validation_summary: receipt,
    }
  }

  // Handle error object
  if (isErrorObject(receipt)) {
    return {
      error_type: receipt.name || receipt.constructor?.name || 'Error',
      error_message: receipt.message,
      error_code: receipt.code,
    }
  }

  // Fallback for unknown receipt types
  return {
    receipt_type: typeof receipt,
    receipt_keys: Object.keys(receipt || {}),
  }
}

/**
 * Context extractor for Intent entities
 * Maps IntentDataModel fields to Datadog-optimized structure
 */
export const extractIntentContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isIntent(entity)) {
    return {}
  }

  // Extract route tokens array for financial analysis
  const routeTokens = entity.route?.tokens?.map((token: any) => ({
    token: token.token || token.tokenAddress,
    amount: token.amount?.toString() || '0',
  })) || []

  // Extract reward tokens array for comprehensive reward tracking
  const rewardTokens = entity.reward?.tokens?.map((token: any) => ({
    token: token.token || token.tokenAddress,
    amount: token.amount?.toString() || '0',
  })) || []

  // Extract call data context for execution path visibility
  const routeCalls = entity.route?.calls?.map((call: any) => ({
    target: call.target || call.to,
    value: call.value?.toString() || '0',
    callData: call.callData ? call.callData.substring(0, 100) + '...' : undefined, // Truncate for size limits
  })) || []

  const baseContext: ExtractedContext = {
    eco: {
      intent_hash: entity.hash,
      quote_id: entity.quoteID,
      creator: entity.route?.creator,
      prover: entity.route?.prover,
      source_chain_id: entity.route?.source,
      destination_chain_id: entity.route?.destination,
      funder: entity.funder,
      inbox: entity.route?.inbox || entity.inbox,
      // New schema fields for complete coverage
      salt: entity.route?.salt || entity.salt,
      log_index: entity.logIndex,
      deadline: entity.route?.deadline?.toString() || entity.deadline,
      d_app_id: entity.dAppID,
      // Route token information (first and last for backward compatibility)
      token_in_address: routeTokens[0]?.token,
      token_out_address: routeTokens[routeTokens.length - 1]?.token,
      amount_in: routeTokens[0]?.amount,
      amount_out: routeTokens[routeTokens.length - 1]?.amount,
    },
    metrics: {
      native_value: entity.reward?.nativeValue?.toString(),
      deadline: entity.route?.deadline?.toString(),
      // Complete token arrays for detailed analysis
      route_tokens: routeTokens.length > 0 ? routeTokens : undefined,
      reward_tokens: rewardTokens.length > 0 ? rewardTokens : undefined,
      // Call data context for execution visibility
      route_calls: routeCalls.length > 0 ? routeCalls : undefined,
      route_calls_count: routeCalls.length,
    },
    operation: {
      log_index: entity.logIndex,
      created_at: entity.createdAt?.toISOString(),
      updated_at: entity.updatedAt?.toISOString(),
      route_complexity: {
        token_count: routeTokens.length,
        call_count: routeCalls.length,
        has_rewards: rewardTokens.length > 0,
      },
    },
  }

  // Add receipt data if available
  if (entity.receipt) {
    const receiptData = extractReceiptData(entity.receipt)
    if (Object.keys(receiptData).length > 0) {
      baseContext.metrics = {
        ...baseContext.metrics,
        ...receiptData,
      }
    }
  }

  return baseContext
}

/**
 * Context extractor for IntentSourceModel entities
 * Maps IntentSourceModel fields to Datadog-optimized structure with receipt data
 */
export const extractIntentSourceModelContext: ContextExtractor = (
  entity: any,
): ExtractedContext => {
  if (!entityTypeGuards.isIntentSourceModel(entity)) {
    return {}
  }

  const intent = entity.intent

  const baseContext: ExtractedContext = {
    eco: {
      intent_hash: intent.hash,
      quote_id: intent.quoteID,
      creator: intent.route?.creator,
      prover: intent.route?.prover,
      source_chain_id: intent.route?.source,
      destination_chain_id: intent.route?.destination,
      funder: intent.funder,
      inbox_address: intent.route?.inbox,
    },
    metrics: {
      native_value: intent.reward?.nativeValue?.toString(),
      deadline: intent.route?.deadline?.toString(),
      token_amounts: intent.reward?.rewardTokens?.map((token: any) => ({
        address: token.tokenAddress,
        amount: token.amount?.toString(),
      })),
    },
    operation: {
      status: entity.status,
      log_index: intent.logIndex,
      created_at: entity.createdAt?.toISOString(),
      updated_at: entity.updatedAt?.toISOString(),
    },
  }

  // Add receipt data if available - this is the key enhancement!
  if (entity.receipt) {
    const receiptData = extractReceiptData(entity.receipt)
    if (Object.keys(receiptData).length > 0) {
      baseContext.metrics = {
        ...baseContext.metrics,
        ...receiptData,
      }
    }
  }

  return baseContext
}

/**
 * Context extractor for Quote entities
 * Maps QuoteIntentModel fields to Datadog-optimized structure
 */
export const extractQuoteContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isQuote(entity)) {
    return {}
  }

  return {
    eco: {
      quote_id: entity.quoteID,
      d_app_id: entity.dAppID,
      intent_execution_type: entity.intentExecutionType,
      // New schema field for complete coverage
      receipt: entity.receipt ? JSON.stringify(entity.receipt) : undefined,
    },
    metrics: {
      route_tokens: entity.route?.routeTokens?.map((token: any) => ({
        address: token.tokenAddress,
        amount: token.amount?.toString(),
        chain_id: token.chainId,
      })),
      reward_tokens: entity.reward?.rewardTokens?.map((token: any) => ({
        address: token.tokenAddress,
        amount: token.amount?.toString(),
        chain_id: token.chainId,
      })),
    },
    operation: {
      created_at: entity.createdAt?.toISOString(),
      updated_at: entity.updatedAt?.toISOString(),
    },
  }
}

/**
 * Context extractor for Wallet entities
 */
export const extractWalletContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isWallet(entity)) {
    return {}
  }

  const walletAddress = entity.address || entity.walletAddress

  return {
    eco: {
      wallet_address: walletAddress,
    },
    operation: {
      wallet_type: entity.type || 'unknown',
    },
  }
}

/**
 * Context extractor for Transaction entities
 */
export const extractTransactionContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isTransaction(entity)) {
    return {}
  }

  const txHash = entity.txHash || entity.transactionHash || entity.hash

  return {
    eco: {
      transaction_hash: txHash,
      source_chain_id: entity.chainId || entity.sourceChainId,
      destination_chain_id: entity.destinationChainId,
    },
    metrics: {
      gas_used: entity.gasUsed?.toString(),
      gas_price: entity.gasPrice?.toString(),
      execution_price: entity.executionPrice?.toString(),
      block_number: entity.blockNumber?.toString(),
    },
    operation: {
      status: entity.status,
      confirmation_time: entity.confirmationTime,
    },
  }
}

/**
 * Context extractor for Quote Rejection entities
 */
export const extractQuoteRejectionContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entity || typeof entity !== 'object') {
    return {}
  }

  // Check if this looks like a quote rejection entity
  if (!('rejectionReason' in entity || 'reason' in entity)) {
    return {}
  }

  return {
    eco: {
      rebalance_id: entity.rebalanceId,
      rejection_reason: entity.rejectionReason || entity.reason,
      strategy: entity.strategy,
      wallet_address: entity.walletAddress,
    },
    metrics: {
      swap_amount: entity.swapAmount?.toString(),
      slippage: entity.slippage,
    },
    operation: {
      rejected_at: entity.createdAt?.toISOString(),
      rejection_type: entity.rejectionType,
    },
  }
}

/**
 * Context extractor for RebalanceJobData entities
 */
export const extractRebalanceJobDataContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isRebalanceJobData(entity)) {
    return {}
  }

  return {
    eco: {
      rebalance_id: entity.rebalanceJobID,
      wallet_address: entity.walletAddress,
      group_id: entity.groupID,
      source_chain_id: entity.network,
    },
    operation: {
      job_type: 'rebalance_execution',
      network: entity.network,
    },
  }
}

/**
 * Context extractor for RebalanceRequest entities
 */
export const extractRebalanceRequestContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isRebalanceRequest(entity)) {
    return {}
  }

  const firstQuote = entity.quotes?.[0]
  const token = entity.token

  return {
    eco: {
      strategy: firstQuote?.strategy || 'multi-strategy',
      source_chain_id: token?.config?.chainId,
      group_id: firstQuote?.groupID,
    },
    metrics: {
      quotes_count: entity.quotes?.length || 0,
      token_address: token?.config?.address,
      total_amount_in: entity.quotes
        ?.reduce((sum: bigint, quote: any) => sum + (quote.amountIn || 0n), 0n)
        ?.toString(),
      total_amount_out: entity.quotes
        ?.reduce((sum: bigint, quote: any) => sum + (quote.amountOut || 0n), 0n)
        ?.toString(),
    },
    operation: {
      request_type: 'rebalance_request',
    },
  }
}

/**
 * Context extractor for TokenData entities
 */
export const extractTokenDataContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isTokenData(entity)) {
    return {}
  }

  return {
    eco: {
      source_chain_id: entity.config?.chainId,
    },
    metrics: {
      token_address: entity.config?.address,
      token_symbol: entity.config?.symbol,
      token_decimals: entity.config?.decimals,
      current_balance: entity.balance?.balance?.toString(),
      target_balance: entity.balance?.targetBalance?.toString(),
    },
    operation: {
      token_type: entity.config?.type || 'unknown',
    },
  }
}

/**
 * Context extractor for ValidationChecks entities
 */
export const extractValidationChecksContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isValidationChecks(entity)) {
    return {}
  }

  const failedChecks = Object.entries(entity)
    .filter(([, value]) => value === false)
    .map(([key]) => key)

  return {
    validation: {
      total_checks: Object.keys(entity).length,
      passed_checks: Object.keys(entity).length - failedChecks.length,
      failed_checks: failedChecks,
      validation_result: failedChecks.length === 0 ? 'passed' : 'failed',
    },
    operation: {
      validation_type: 'intent_validation_checks',
    },
  }
}

/**
 * Context extractor for GaslessIntentRequest entities
 */
export const extractGaslessIntentRequestContext: ContextExtractor = (
  entity: any,
): ExtractedContext => {
  if (!entityTypeGuards.isGaslessIntentRequest(entity)) {
    return {}
  }

  return {
    eco: {
      d_app_id: entity.dAppID,
      source_chain_id: entity.route?.source || entity.getSourceChainID?.(),
      destination_chain_id: entity.route?.destination,
      funder: entity.getFunder?.(),
    },
    gasless_intent: {
      request_type: 'gasless_intent_initiation',
      has_permits: !!(entity.permits || entity.permit2),
      permit_count: (entity.permits?.length || 0) + (entity.permit2?.length || 0),
    },
    operation: {
      intent_execution_type: entity.intentExecutionType || 'gasless',
    },
  }
}

/**
 * Context extractor for Provider entities
 * Maps provider service contexts to Datadog-optimized structure
 */
export const extractProviderContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entity || typeof entity !== 'object') {
    return {}
  }

  // Check for provider-specific identifiers
  if (!('providerId' in entity || 'providerName' in entity || 'id' in entity)) {
    return {}
  }

  return {
    eco: {
      provider_id: entity.providerId || entity.providerName || entity.id,
      source_chain_id: entity.chainId || entity.sourceChainId,
      destination_chain_id: entity.destinationChainId,
      wallet_address: entity.walletAddress || entity.address,
    },
    metrics: {
      balance: entity.balance?.toString(),
      liquidity_amount: entity.liquidityAmount?.toString(),
      quote_amount: entity.quoteAmount?.toString(),
    },
    operation: {
      provider_enabled: entity.enabled,
      provider_status: entity.status,
      last_updated: entity.updatedAt?.toISOString() || entity.lastUpdated?.toISOString(),
    },
  }
}

/**
 * Context extractor for Processor entities
 * Maps BullMQ processor contexts to Datadog-optimized structure
 */
export const extractProcessorContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entity || typeof entity !== 'object') {
    return {}
  }

  // Check for processor-specific identifiers
  if (!('processorType' in entity || 'jobType' in entity || 'name' in entity)) {
    return {}
  }

  return {
    eco: {
      processor_type: entity.processorType || entity.jobType || entity.name,
      job_id: entity.jobId || entity.id,
      intent_hash: entity.intentHash,
    },
    metrics: {
      processing_time: entity.processingTime?.toString(),
      retry_count: entity.retryCount?.toString() || entity.attempts?.toString(),
      queue_wait_time: entity.queueWaitTime?.toString(),
    },
    operation: {
      job_status: entity.status || entity.state,
      created_at: entity.createdAt?.toISOString() || entity.timestamp?.toISOString(),
      completed_at: entity.completedAt?.toISOString() || entity.finishedOn?.toISOString(),
    },
  }
}

/**
 * Context extractor for Health entities
 * Maps health check and monitoring contexts to Datadog-optimized structure
 */
export const extractHealthContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entity || typeof entity !== 'object') {
    return {}
  }

  // Check for health-specific identifiers
  if (!('checkType' in entity || 'healthStatus' in entity || 'target' in entity)) {
    return {}
  }

  return {
    eco: {
      health_check_type: entity.checkType || entity.type,
      target_component: entity.target || entity.component,
      source_chain_id: entity.chainId,
    },
    metrics: {
      response_time: entity.responseTime?.toString(),
      uptime: entity.uptime?.toString(),
      error_count: entity.errorCount?.toString(),
    },
    operation: {
      health_status: entity.healthStatus || entity.status,
      is_healthy: entity.healthy || entity.isHealthy,
      check_timestamp: entity.timestamp?.toISOString() || entity.checkedAt?.toISOString(),
    },
  }
}

/**
 * Context extractor for Analytics entities
 * Maps analytics service contexts to Datadog-optimized structure
 */
export const extractAnalyticsContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entity || typeof entity !== 'object') {
    return {}
  }

  // Check for analytics-specific identifiers
  if (!('eventType' in entity || 'analyticsType' in entity || 'metric' in entity)) {
    return {}
  }

  return {
    eco: {
      analytics_event: entity.eventType || entity.analyticsType,
      metric_name: entity.metric || entity.name,
      source_chain_id: entity.chainId,
    },
    metrics: {
      metric_value: entity.value?.toString() || entity.metricValue?.toString(),
      count: entity.count?.toString(),
      duration: entity.duration?.toString(),
    },
    operation: {
      analytics_status: entity.status,
      recorded_at: entity.recordedAt?.toISOString() || entity.timestamp?.toISOString(),
    },
  }
}

/**
 * Context extractor for Validator entities
 * Maps validation service contexts to Datadog-optimized structure
 */
export const extractValidatorContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entity || typeof entity !== 'object') {
    return {}
  }

  // Check for validator-specific identifiers
  if (!('validationType' in entity || 'validator' in entity || 'validationResult' in entity)) {
    return {}
  }

  return {
    eco: {
      validation_type: entity.validationType || entity.validator,
      intent_hash: entity.intentHash,
      permit_hash: entity.permitHash,
    },
    validation: {
      is_valid: entity.isValid || entity.valid || entity.validationResult,
      validation_errors: entity.validationErrors || entity.errors,
      validation_warnings: entity.validationWarnings || entity.warnings,
    },
    operation: {
      validation_status: entity.status,
      validated_at: entity.validatedAt?.toISOString() || entity.timestamp?.toISOString(),
    },
  }
}

/**
 * Main context extraction function that tries all extractors
 */
export async function extractContextFromEntity(entity: any): Promise<ExtractedContext> {
  if (!entity || typeof entity !== 'object') {
    return {}
  }

  // Try extractors in order of specificity
  const extractors = [
    extractRebalanceContext,
    extractRebalanceJobDataContext,
    extractRebalanceRequestContext,
    extractIntentSourceModelContext, // Added before extractIntentContext for proper priority
    extractIntentContext,
    extractQuoteContext,
    extractQuoteRejectionContext,
    extractTokenDataContext,
    extractValidationChecksContext,
    extractGaslessIntentRequestContext,
    extractProviderContext, // New provider context extractor
    extractProcessorContext, // New processor context extractor
    extractHealthContext, // New health context extractor
    extractAnalyticsContext, // New analytics context extractor
    extractValidatorContext, // New validator context extractor
    extractWalletContext,
    extractTransactionContext,
  ]

  for (const extractor of extractors) {
    try {
      const result = await Promise.resolve(extractor(entity))
      if (result && Object.keys(result).length > 0) {
        return result
      }
    } catch (error) {
      // Log extraction error but continue with other extractors
      // Log extraction error but continue with other extractors
    }
  }

  // Fallback: extract common fields
  return extractCommonFields(entity)
}

/**
 * Fallback context extractor for common fields
 */
function extractCommonFields(entity: any): ExtractedContext {
  const context: ExtractedContext = {}

  // Common ID fields
  if (entity.id) context.eco = { ...context.eco, entity_id: entity.id }
  if (entity._id) context.eco = { ...context.eco, entity_id: entity._id.toString() }

  // Common timestamp fields
  if (entity.createdAt) {
    context.operation = {
      ...context.operation,
      created_at: entity.createdAt.toISOString(),
    }
  }
  if (entity.updatedAt) {
    context.operation = {
      ...context.operation,
      updated_at: entity.updatedAt.toISOString(),
    }
  }

  // Common status fields
  if (entity.status) {
    context.operation = { ...context.operation, status: entity.status }
  }

  return context
}

/**
 * Merge multiple extracted contexts
 */
export function mergeContexts(...contexts: ExtractedContext[]): ExtractedContext {
  const merged: ExtractedContext = {}

  for (const context of contexts) {
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = { ...merged[key], ...value }
      } else {
        merged[key] = value
      }
    }
  }

  return merged
}
