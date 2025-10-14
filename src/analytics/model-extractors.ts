/**
 * Model extraction utilities for analytics
 *
 * These utilities extract only analytics-relevant fields from large objects
 * to prevent OOM crashes caused by logging 100KB+ model objects.
 *
 * CRITICAL: Do NOT pass full model/solver/receipt objects to analytics.
 * Use these extractors to reduce payload size from ~100KB to ~1-2KB.
 */

/**
 * Extract only analytics-relevant fields from IntentSourceModel
 * Prevents logging 100KB+ model objects that can cause OOM crashes
 *
 * @param model - IntentSourceModel instance
 * @returns Compact summary object (~1-2KB instead of ~100KB)
 */
export function extractIntentModelSummary(model: any): any {
  if (!model) return null

  return {
    // Intent identification
    intent_hash: model.intent?.hash,
    status: model.status,

    // Route information (essential for analytics)
    source_chain_id: model.intent?.route?.source,
    destination_chain_id: model.intent?.route?.destination,
    creator: model.intent?.route?.creator,
    prover: model.intent?.route?.prover,

    // Counts instead of full arrays (prevents logging massive token/call arrays)
    token_count: model.intent?.route?.tokens?.length || 0,
    call_count: model.intent?.route?.calls?.length || 0,
    target_count: model.intent?.route?.targets?.length || 0,

    // Receipt summary (not full receipt which can be 50KB+)
    has_receipt: !!model.receipt,
    receipt_status: model.receipt?.status,
    receipt_gas_used: model.receipt?.gasUsed?.toString(),
    receipt_block_number: model.receipt?.blockNumber?.toString(),
    receipt_log_count: model.receipt?.logs?.length || 0,

    // Timestamps
    created_at: model.createdAt?.toISOString?.() || model.createdAt,
    updated_at: model.updatedAt?.toISOString?.() || model.updatedAt,

    // Event summary (not full event data)
    has_event: !!model.event,
    event_transaction_hash: model.event?.transactionHash,
    event_log_index: model.event?.logIndex,

    // Validation info
    validation_status: model.validationStatus,
    is_feasible: model.isFeasible,

    // EXPLICITLY EXCLUDED (these cause OOM):
    // - model.intent (full intent object with route, tokens, calls)
    // - model.receipt (full receipt with 100+ logs)
    // - model.event (full event data)
    // - model.intent.route.tokens (array of token objects)
    // - model.intent.route.calls (array of call objects)
  }
}

/**
 * Extract only analytics-relevant fields from Solver configuration
 * Prevents logging full solver configs with all targets
 *
 * @param solver - Solver configuration object
 * @returns Compact summary object
 */
export function extractSolverSummary(solver: any): any {
  if (!solver) return null

  return {
    // Core identification
    chain_id: solver.chainID,
    inbox_address: solver.inboxAddress,

    // Configuration summary (counts instead of full objects)
    targets_count: solver.targets ? Object.keys(solver.targets).length : 0,
    supported_tokens_count: solver.supportedTokens?.length || 0,

    // Capabilities
    supports_erc20: !!solver.supportsERC20,
    supports_native: !!solver.supportsNative,

    // EXPLICITLY EXCLUDED (these cause OOM):
    // - solver.targets (full target configurations)
    // - solver.supportedTokens (array of token addresses)
    // - Any nested configuration objects
  }
}

/**
 * Extract only analytics-relevant fields from transaction receipt
 * Prevents logging 50KB+ receipts with 100+ logs
 *
 * @param receipt - Transaction receipt object
 * @returns Compact summary object
 */
export function extractReceiptSummary(receipt: any): any {
  if (!receipt) return null

  return {
    // Transaction identification
    transaction_hash: receipt.transactionHash,
    block_hash: receipt.blockHash,
    block_number: receipt.blockNumber?.toString(),

    // Status
    status: receipt.status,
    type: receipt.type,

    // Gas metrics
    gas_used: receipt.gasUsed?.toString(),
    cumulative_gas_used: receipt.cumulativeGasUsed?.toString(),
    effective_gas_price: receipt.effectiveGasPrice?.toString(),

    // Log summary (count instead of full logs array)
    log_count: receipt.logs?.length || 0,

    // Addresses
    from: receipt.from,
    to: receipt.to,
    contract_address: receipt.contractAddress,

    // EXPLICITLY EXCLUDED (these cause OOM):
    // - receipt.logs (array of 100+ log objects with topics and data)
    // - Full topic arrays from logs
    // - Log data fields (can be kilobytes each)
  }
}

/**
 * Extract only analytics-relevant fields from fulfillment data
 *
 * @param fulfillment - Fulfillment object
 * @returns Compact summary object
 */
export function extractFulfillmentSummary(fulfillment: any): any {
  if (!fulfillment) return null

  return {
    // Identification
    intent_hash: fulfillment.intentHash,
    fulfillment_hash: fulfillment.fulfillmentHash,
    transaction_hash: fulfillment.transactionHash,

    // Chain info
    source_chain_id: fulfillment.sourceChainId,
    destination_chain_id: fulfillment.destinationChainId,

    // Addresses
    solver: fulfillment.solver,
    filler: fulfillment.filler,

    // Status
    status: fulfillment.status,

    // Timing
    timestamp: fulfillment.timestamp,

    // EXPLICITLY EXCLUDED:
    // - Full proof data
    // - Full transaction data
    // - Nested intent objects
  }
}

/**
 * Extract only analytics-relevant fields from intent data
 * Use this instead of passing the full intent.route object
 *
 * @param intent - Intent data object
 * @returns Compact summary object
 */
export function extractIntentSummary(intent: any): any {
  if (!intent) return null

  return {
    // Identification
    hash: intent.hash,
    nonce: intent.nonce?.toString(),

    // Route summary
    source: intent.route?.source,
    destination: intent.route?.destination,
    creator: intent.route?.creator,
    prover: intent.route?.prover,

    // Counts
    token_count: intent.route?.tokens?.length || 0,
    call_count: intent.route?.calls?.length || 0,

    // Timing
    deadline: intent.route?.deadline?.toString(),

    // EXPLICITLY EXCLUDED (these cause OOM):
    // - intent.route.tokens (full token array)
    // - intent.route.calls (full call array)
    // - intent.route.targets (full target array)
  }
}

/**
 * Extract only analytics-relevant fields from error objects
 * Prevents logging huge error stacks and context objects
 *
 * @param error - Error object
 * @returns Compact error summary
 */
export function extractErrorSummary(error: any): any {
  if (!error) return null

  // If it's already a simple string/number, return as-is
  if (typeof error !== 'object') {
    return { message: String(error) }
  }

  return {
    // Core error info
    message: error.message || String(error),
    name: error.name,
    code: error.code,

    // Limited stack trace (first 500 chars only)
    stack: error.stack ? error.stack.substring(0, 500) + '...' : undefined,

    // Context summary (not full context)
    has_context: !!error.context,
    context_keys: error.context ? Object.keys(error.context).join(',') : undefined,

    // EXPLICITLY EXCLUDED:
    // - Full stack trace (can be 10KB+)
    // - Full context objects
    // - Nested error objects
  }
}

/**
 * Estimate the approximate size of an object in memory
 * Used to reject oversized objects before expensive serialization
 *
 * @param obj - Object to estimate
 * @param maxSize - Maximum allowed size (default: 10000 properties)
 * @returns Estimated property count
 * @throws Error if object exceeds maxSize
 */
export function estimateObjectSize(obj: any, maxSize = 10000): number {
  let propertyCount = 0
  const seen = new WeakSet()

  const estimate = (o: any, depth = 0): void => {
    // Null/undefined check
    if (o === null || o === undefined) return

    // Primitive types
    if (typeof o !== 'object') {
      propertyCount++
      return
    }

    // Circular reference check
    if (seen.has(o)) return
    seen.add(o)

    // Recurse into object properties
    try {
      // Get keys to count properties
      const keys = Object.keys(o)

      // Increment count for each property
      propertyCount += keys.length

      // Size limit check - throw early to prevent further processing
      if (propertyCount > maxSize) {
        throw new Error(`Object too large: exceeds ${maxSize} properties`)
      }

      // Recurse into nested objects
      for (const key of keys) {
        estimate(o[key], depth + 1)
      }
    } catch (e) {
      // Re-throw size limit errors
      if (e instanceof Error && e.message.includes('Object too large')) {
        throw e
      }
      // Ignore other errors (e.g., property access errors)
    }
  }

  estimate(obj)
  return propertyCount
}
