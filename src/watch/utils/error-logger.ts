import { PublicClient } from 'viem'
import { extractClientInfo } from './client-info-extractor'
import { EcoAnalyticsService } from '@/analytics'
import { Logger } from '@nestjs/common'

/**
 * Enhanced error context for watch service errors
 */
export interface WatchErrorContext {
  chainId: number | 'unknown'
  rpcUrl: string
  contractAddress?: string
  contractType?: string
  errorType?: string
  operationName?: string
  serviceName?: string
  additionalContext?: Record<string, any>
}

/**
 * Logs errors with enhanced context for watch services
 * @param error The error that occurred
 * @param client The PublicClient involved
 * @param context Additional context for the error
 * @param logger The logger instance to use
 * @param analytics The analytics service for tracking
 */
export function logWatchError(
  error: any,
  client: PublicClient,
  context: Partial<WatchErrorContext>,
  logger: Logger,
  analytics?: EcoAnalyticsService,
): void {
  const clientInfo = extractClientInfo(client)

  const enrichedContext: WatchErrorContext = {
    chainId: clientInfo.chainId,
    rpcUrl: clientInfo.rpcUrl,
    ...context,
  }

  // Log error with structured format
  logger.error({
    msg: `Watch service error: ${context.operationName || 'unknown operation'}`,
    error: error.message || String(error),
    errorStack: error.stack,
    service: context.serviceName || 'WatchService',
    operation: context.operationName || 'unknown',
    chainId: enrichedContext.chainId,
    rpcUrl: enrichedContext.rpcUrl,
    contractAddress: enrichedContext.contractAddress,
    contractType: enrichedContext.contractType,
    errorType: enrichedContext.errorType || error.name || 'UnknownError',
    ...enrichedContext.additionalContext,
  })

  // Track with analytics if available
  if (analytics) {
    analytics.trackError(
      `WATCH_${(context.errorType || 'UNKNOWN_ERROR').toUpperCase()}`,
      error,
      enrichedContext,
    )
  }
}

/**
 * Creates a partial error context for contract-based operations
 * @param contract Contract configuration object
 * @returns Partial error context
 */
export function createContractErrorContext<T extends { chainID: number }>(
  contract: T,
  contractType?: string,
): Partial<WatchErrorContext> {
  let contractAddress: string | undefined
  const additionalContext: Record<string, any> = {}

  // Extract contract address based on common patterns
  if ('sourceAddress' in contract && typeof contract.sourceAddress === 'string') {
    contractAddress = contract.sourceAddress
    contractType = contractType || 'IntentSource'
  } else if ('inboxAddress' in contract && typeof contract.inboxAddress === 'string') {
    contractAddress = contract.inboxAddress
    contractType = contractType || 'Inbox'
  } else if ('address' in contract && typeof contract.address === 'string') {
    contractAddress = contract.address
  }

  // Add additional context based on contract type
  if ('network' in contract) {
    additionalContext.network = contract.network
  }
  if ('provers' in contract) {
    additionalContext.provers = contract.provers
  }

  return {
    contractAddress,
    contractType,
    additionalContext,
  }
}
