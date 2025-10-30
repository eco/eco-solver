import { BaseStructuredLogger } from './base-structured-logger'
import { LogLevel, DatadogLogStructure, EcoBusinessContext, OperationContext } from '../types'

export interface ChainSyncLogParams {
  message: string
  sourceNetwork?: string
  chainId?: number
  sourceAddress?: string
  fromBlock?: string | bigint
  toBlock?: string | bigint
  eventCount?: number
  maxBlockRange?: string | bigint
  syncType:
    | 'intent_created'
    | 'intent_funded'
    | 'application_bootstrap'
    | 'sync_transactions'
    | 'missing_transactions'
  status: 'started' | 'completed' | 'failed' | 'no_transactions_found'
  processingTimeMs?: number
  intentHash?: string
  transactionHash?: string
  blockNumber?: number | bigint
  properties?: object
}

export interface ChainSyncLogContext {
  sourceNetwork?: string
  chainId?: number
  sourceAddress?: string
  syncType?:
    | 'intent_created'
    | 'intent_funded'
    | 'application_bootstrap'
    | 'sync_transactions'
    | 'missing_transactions'
  status?: 'started' | 'completed' | 'failed' | 'no_transactions_found'
  intentHash?: string
  transactionHash?: string
}

/**
 * Specialized logger for chain synchronization operations
 * Provides structured logging for blockchain event synchronization, missing transaction detection,
 * and chain state monitoring operations
 */
export class ChainSyncLogger extends BaseStructuredLogger {
  constructor() {
    super('chain-sync-logger', { enableDatadogOptimization: true })
  }

  /**
   * Extract trace ID from current context for APM correlation
   */
  private getTraceId(): string | undefined {
    // Try to get trace ID from various sources
    try {
      // OpenTelemetry
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const opentelemetry = require('@opentelemetry/api')
      const span = opentelemetry.trace.getActiveSpan()
      if (span) {
        return span.spanContext().traceId
      }
    } catch (e) {
      // OpenTelemetry not available, continue
    }

    // Fallback to environment or generate one
    return process.env.DD_TRACE_ID || undefined
  }

  /**
   * Log chain sync operation events with structured business context
   */
  logChainSyncOperation(
    params: ChainSyncLogParams,
    context?: ChainSyncLogContext,
    level: LogLevel = 'info',
  ): void {
    // Extract trace ID if available (from OpenTelemetry or similar)
    const traceId = this.getTraceId()
    const ecoContext: EcoBusinessContext = {
      // High-cardinality identifiers - faceted for search optimization
      intent_hash: params.intentHash || context?.intentHash,
      transaction_hash: params.transactionHash || context?.transactionHash,
      // Medium-cardinality field - good for faceting
      source_chain_id: params.chainId || context?.chainId,
      // Chain sync specific fields
      sync_type: params.syncType,
      chain_sync_status: params.status,
      ...(params.properties || {}),
    }

    const operationContext: OperationContext = {
      type: 'chain-sync',
      status: params.status,
      duration_ms: params.processingTimeMs,
    }

    const structure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message: params.message,
      service: 'eco-solver', // Use consistent service name across all logs
      status: level,
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},operation:chain-sync,version:${process.env.APP_VERSION || 'unknown'}`,
      // Remove host - let Datadog Agent set this automatically
      trace_id: traceId,
      'logger.name': 'ChainSyncLogger',
      eco: {
        ...ecoContext,
        // Chain sync metadata in business context for better processing
        source_network: params.sourceNetwork || context?.sourceNetwork,
        source_address: params.sourceAddress,
        from_block:
          typeof params.fromBlock === 'bigint' ? params.fromBlock.toString() : params.fromBlock,
        to_block: typeof params.toBlock === 'bigint' ? params.toBlock.toString() : params.toBlock,
        event_count: params.eventCount,
        max_block_range:
          typeof params.maxBlockRange === 'bigint'
            ? params.maxBlockRange.toString()
            : params.maxBlockRange,
        block_number:
          typeof params.blockNumber === 'bigint' ? Number(params.blockNumber) : params.blockNumber,
      },
      operation: operationContext,
    }

    this.logStructured(structure, level)
  }

  /**
   * Log application bootstrap sync operations
   */
  logBootstrapSync(
    sourceNetwork: string,
    chainId: number,
    status: 'started' | 'completed' | 'failed',
    processingTimeMs?: number,
    eventCount?: number,
  ): void {
    this.logChainSyncOperation({
      message: `Chain sync bootstrap ${status} for ${sourceNetwork}`,
      sourceNetwork,
      chainId,
      syncType: 'application_bootstrap',
      status,
      processingTimeMs,
      eventCount,
    })
  }

  /**
   * Log transaction synchronization operations
   */
  logTransactionSync(
    sourceNetwork: string,
    chainId: number,
    status: 'started' | 'completed' | 'failed',
    eventCount?: number,
    processingTimeMs?: number,
  ): void {
    this.logChainSyncOperation({
      message: `Transaction sync ${status} for ${sourceNetwork} - found ${eventCount || 0} events`,
      sourceNetwork,
      chainId,
      syncType: 'sync_transactions',
      status,
      eventCount,
      processingTimeMs,
    })
  }

  /**
   * Log missing transaction detection operations
   */
  logMissingTransactions(
    sourceNetwork: string,
    chainId: number,
    fromBlock: string | bigint | undefined,
    toBlock: string | bigint,
    eventCount: number,
    syncType: 'intent_created' | 'intent_funded',
    maxBlockRange?: string | bigint,
  ): void {
    const status = eventCount === 0 ? 'no_transactions_found' : 'completed'

    this.logChainSyncOperation({
      message:
        eventCount === 0
          ? `No transactions found for source ${sourceNetwork} to sync from block ${fromBlock}`
          : `Found ${eventCount} missing transactions for ${sourceNetwork} from block ${fromBlock} to ${toBlock}`,
      sourceNetwork,
      chainId,
      fromBlock,
      toBlock,
      eventCount,
      maxBlockRange,
      syncType,
      status,
    })
  }

  /**
   * Log individual transaction processing during sync
   */
  logTransactionProcessed(
    intentHash: string,
    transactionHash: string,
    blockNumber: number | bigint,
    sourceNetwork: string,
    chainId: number,
    syncType: 'intent_created' | 'intent_funded',
  ): void {
    this.logChainSyncOperation({
      message: `Processed ${syncType} transaction during sync`,
      sourceNetwork,
      chainId,
      intentHash,
      transactionHash,
      blockNumber: typeof blockNumber === 'bigint' ? Number(blockNumber) : blockNumber,
      syncType,
      status: 'completed',
    })
  }

  /**
   * Log sync errors with detailed context
   */
  logSyncError(
    error: Error,
    sourceNetwork?: string,
    chainId?: number,
    syncType?:
      | 'intent_created'
      | 'intent_funded'
      | 'application_bootstrap'
      | 'sync_transactions'
      | 'missing_transactions',
    fromBlock?: string | bigint,
    toBlock?: string | bigint,
  ): void {
    const traceId = this.getTraceId()
    const structure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message: `Chain sync error: ${error.message}`,
      service: 'eco-solver',
      status: 'error',
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},operation:chain-sync,version:${process.env.APP_VERSION || 'unknown'}`,
      trace_id: traceId,
      'logger.name': 'ChainSyncLogger',
      eco: {
        sync_type: syncType || 'sync_transactions',
        chain_sync_status: 'failed',
        source_network: sourceNetwork,
        source_chain_id: chainId,
        from_block: typeof fromBlock === 'bigint' ? fromBlock.toString() : fromBlock,
        to_block: typeof toBlock === 'bigint' ? toBlock.toString() : toBlock,
      },
      operation: {
        type: 'chain-sync',
        status: 'failed',
      },
      error: {
        kind: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 1000), // Truncate stack trace
        recoverable: true, // Chain sync errors are typically recoverable
      },
    }

    this.logStructured(structure, 'error')
  }

  /**
   * Log sync performance metrics
   */
  logSyncPerformance(
    sourceNetwork: string,
    chainId: number,
    syncType: 'intent_created' | 'intent_funded',
    eventCount: number,
    processingTimeMs: number,
    blockRange: bigint,
  ): void {
    const eventsPerSecond = eventCount > 0 ? Math.round((eventCount / processingTimeMs) * 1000) : 0
    const blocksPerSecond =
      processingTimeMs > 0 ? Math.round((Number(blockRange) / processingTimeMs) * 1000) : 0
    const traceId = this.getTraceId()

    const structure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message: `Sync performance: ${eventCount} events, ${blockRange} blocks in ${processingTimeMs}ms`,
      service: 'eco-solver',
      status: 'info',
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},operation:chain-sync,version:${process.env.APP_VERSION || 'unknown'}`,
      trace_id: traceId,
      'logger.name': 'ChainSyncLogger',
      eco: {
        sync_type: syncType,
        chain_sync_status: 'completed',
        source_network: sourceNetwork,
        source_chain_id: chainId,
        event_count: eventCount,
      },
      operation: {
        type: 'chain-sync',
        status: 'completed',
        duration_ms: processingTimeMs,
      },
      performance: {
        response_time_ms: processingTimeMs,
        // Custom performance metrics for chain sync
        events_per_second: eventsPerSecond,
        blocks_per_second: blocksPerSecond,
        block_range_processed: Number(blockRange),
        throughput_efficiency: eventCount > 0 ? eventCount / Number(blockRange) : 0,
      },
    }

    this.logStructured(structure, 'info')
  }

  /**
   * Log last recorded transaction info
   */
  logLastRecordedTransaction(
    sourceNetwork: string,
    chainId: number,
    lastBlockNumber?: number,
    transactionHash?: string,
    intentHash?: string,
  ): void {
    this.logChainSyncOperation({
      message: lastBlockNumber
        ? `Last recorded transaction at block ${lastBlockNumber} for ${sourceNetwork}`
        : `No previous transactions found for ${sourceNetwork}`,
      sourceNetwork,
      chainId,
      blockNumber: lastBlockNumber,
      transactionHash,
      intentHash,
      syncType: 'missing_transactions',
      status: 'completed',
    })
  }
}
