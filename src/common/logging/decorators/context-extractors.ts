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
      wallet_address: entity.wallet,
      strategy: entity.strategy,
      source_chain_id: entity.tokenIn?.chainId,
      destination_chain_id: entity.tokenOut?.chainId,
      group_id: entity.groupId,
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
 * Context extractor for Intent entities
 * Maps IntentDataModel fields to Datadog-optimized structure
 */
export const extractIntentContext: ContextExtractor = (entity: any): ExtractedContext => {
  if (!entityTypeGuards.isIntent(entity)) {
    return {}
  }

  return {
    eco: {
      intent_hash: entity.hash,
      quote_id: entity.quoteID,
      creator: entity.route?.creator,
      prover: entity.route?.prover,
      source_chain_id: entity.route?.source,
      destination_chain_id: entity.route?.destination,
      funder: entity.funder,
      inbox_address: entity.route?.inbox,
    },
    metrics: {
      native_value: entity.reward?.nativeValue?.toString(),
      deadline: entity.route?.deadline?.toString(),
      token_amounts: entity.reward?.rewardTokens?.map((token: any) => ({
        address: token.tokenAddress,
        amount: token.amount?.toString(),
      })),
    },
    operation: {
      log_index: entity.logIndex,
      created_at: entity.createdAt?.toISOString(),
      updated_at: entity.updatedAt?.toISOString(),
    },
  }
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
 * Main context extraction function that tries all extractors
 */
export async function extractContextFromEntity(entity: any): Promise<ExtractedContext> {
  if (!entity || typeof entity !== 'object') {
    return {}
  }

  // Try extractors in order of specificity
  const extractors = [
    extractRebalanceContext,
    extractIntentContext,
    extractQuoteContext,
    extractQuoteRejectionContext,
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
      console.warn(`Context extraction failed for entity:`, error)
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
