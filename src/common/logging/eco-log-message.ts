import { EcoError } from '../errors/eco-error'
import {
  DatadogLogStructure,
  EcoBusinessContext,
  OperationContext,
  MetricsContext,
  ErrorContext,
  PerformanceContext,
  IntentOperationLogParams,
  LiquidityOperationLogParams,
  QuoteGenerationLogParams,
  HealthOperationLogParams,
  GenericOperationLogParams,
  TransactionOperationLogParams,
  PerformanceMetricLogParams,
  LogLevel,
  DATADOG_LIMITS,
} from './types'

interface BaseLoggingDataParams {
  message: string
  properties?: object
}

interface LoggingDataParamsWithUser extends BaseLoggingDataParams {
  userID: string
}

interface LoggingDataParamsWithError extends BaseLoggingDataParams {
  error: EcoError
}

interface LoggingDataParamsWithErrorAndUser extends LoggingDataParamsWithError {
  userID: string
}

interface LoggingDataParamsWithErrorAndId extends LoggingDataParamsWithError {
  id?: string
}

interface LoggingDataParamsWithId extends BaseLoggingDataParams {
  id?: string
}

export class EcoLogMessage {
  private readonly _content: object

  private constructor(params: BaseLoggingDataParams) {
    this._content = {
      msg: params.message,
      ...params.properties,
    }
  }

  get content(): object {
    return this._content
  }

  // Enhanced constructor with Datadog structure
  private static createDatadogStructure(
    message: string,
    level: LogLevel = 'info',
    additionalData: Partial<DatadogLogStructure> = {},
  ): DatadogLogStructure {
    const baseStructure: DatadogLogStructure = {
      '@timestamp': new Date().toISOString(),
      message,
      service: 'eco-solver',
      status: level,
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV || 'development'},service:eco-solver`,
      host: process.env.HOSTNAME || 'eco-solver-instance',
      env: process.env.NODE_ENV || 'development',
      version: '1.5', //todo we need to start versioning
      'logger.name': 'EcoLogMessage',
      ...additionalData,
    }

    // Add trace_id if available from APM
    const traceId = this.getTraceId()
    if (traceId) {
      baseStructure.trace_id = traceId
    }

    return this.validateLogStructure(baseStructure)
  }

  // Helper to get trace ID from APM context
  private static getTraceId(): string | undefined {
    // This would typically come from your APM library (e.g., dd-trace)
    // For now, return undefined as we don't have dd-trace installed
    return undefined
  }

  // Validate log structure against Datadog limits
  private static validateLogStructure(structure: DatadogLogStructure): DatadogLogStructure {
    const validated = { ...structure }

    // Count attributes and limit to MAX_ATTRIBUTES
    const attributeCount = this.countAttributes(validated)
    if (attributeCount > DATADOG_LIMITS.MAX_ATTRIBUTES) {
      // eslint-disable-next-line no-console
      console.warn(
        `Log structure exceeds ${DATADOG_LIMITS.MAX_ATTRIBUTES} attributes. Some data may be truncated.`,
      )
    }

    // Validate log size
    const logSize = JSON.stringify(validated).length
    if (logSize > DATADOG_LIMITS.MAX_LOG_SIZE) {
      // eslint-disable-next-line no-console
      console.warn(
        `Log size (${logSize} bytes) exceeds ${DATADOG_LIMITS.MAX_LOG_SIZE} bytes limit. Consider reducing log data.`,
      )
    }

    return validated
  }

  // Recursively count attributes in an object
  private static countAttributes(obj: any, depth = 0): number {
    if (depth > DATADOG_LIMITS.MAX_NESTED_LEVELS || typeof obj !== 'object' || obj === null) {
      return 1
    }

    let count = 0
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        count += 1 + this.countAttributes(obj[key], depth + 1)
      }
    }
    return count
  }

  // Create business context from operation params
  private static createEcoContext(params: {
    intentHash?: string
    quoteId?: string
    rebalanceId?: string
    walletAddress?: string
    creator?: string
    prover?: string
    funder?: string
    inbox?: string
    dAppId?: string
    sourceChainId?: number
    destinationChainId?: number
    strategy?: string
    intentExecutionType?: string
    rejectionReason?: string
    transactionHash?: string
    [key: string]: any
  }): EcoBusinessContext {
    return {
      ...(params.intentHash && { intent_hash: params.intentHash }),
      ...(params.quoteId && { quote_id: params.quoteId }),
      ...(params.rebalanceId && { rebalance_id: params.rebalanceId }),
      ...(params.walletAddress && { wallet_address: params.walletAddress }),
      ...(params.creator && { creator: params.creator }),
      ...(params.prover && { prover: params.prover }),
      ...(params.funder && { funder: params.funder }),
      ...(params.inbox && { inbox: params.inbox }),
      ...(params.dAppId && { d_app_id: params.dAppId }),
      ...(params.sourceChainId && { source_chain_id: params.sourceChainId }),
      ...(params.destinationChainId && { destination_chain_id: params.destinationChainId }),
      ...(params.strategy && { strategy: params.strategy }),
      ...(params.intentExecutionType && { intent_execution_type: params.intentExecutionType }),
      ...(params.rejectionReason && { rejection_reason: params.rejectionReason }),
      ...(params.transactionHash && { transaction_hash: params.transactionHash }),
    }
  }

  // Create metrics context
  private static createMetricsContext(params: {
    amountIn?: string
    amountOut?: string
    nativeValue?: string
    slippage?: number
    deadline?: number
    tokenInAddress?: string
    tokenOutAddress?: string
    gasUsed?: number
    gasPrice?: string
    blockNumber?: number
    nonce?: number
    transactionValue?: string
    [key: string]: any
  }): MetricsContext {
    return {
      ...(params.amountIn && { amount_in: params.amountIn }),
      ...(params.amountOut && { amount_out: params.amountOut }),
      ...(params.nativeValue && { native_value: params.nativeValue }),
      ...(params.slippage && { slippage: params.slippage }),
      ...(params.deadline && { deadline: params.deadline }),
      ...(params.tokenInAddress && { token_in_address: params.tokenInAddress }),
      ...(params.tokenOutAddress && { token_out_address: params.tokenOutAddress }),
      ...(params.gasUsed && { gas_used: params.gasUsed }),
      ...(params.gasPrice && { gas_price: params.gasPrice }),
      ...(params.blockNumber && { block_number: params.blockNumber }),
      ...(params.nonce && { nonce: params.nonce }),
      ...(params.transactionValue && { transaction_value: params.transactionValue }),
    }
  }

  // Create error context from EcoError
  private static createErrorContext(error: EcoError): ErrorContext {
    return {
      kind: error.constructor.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      recoverable: (error as any).recoverable || false,
    }
  }

  static fromDefault(params: BaseLoggingDataParams): object {
    return new EcoLogMessage(params).content
  }

  static withUser(params: LoggingDataParamsWithUser): object {
    const { message, userID, properties } = params

    return this.fromDefault({
      message,
      properties: {
        userID,
        ...properties,
      },
    })
  }

  static withError(params: LoggingDataParamsWithError): object {
    const { message, error, properties } = params

    return this.fromDefault({
      message,
      properties: {
        error: error.toString(),
        ...properties,
      },
    })
  }

  static withErrorAndUser(params: LoggingDataParamsWithErrorAndUser): object {
    const { message, userID, error, properties } = params

    return this.fromDefault({
      message,
      properties: {
        userID,
        error: error.toString(),
        ...properties,
      },
    })
  }

  static withId(params: LoggingDataParamsWithId): object {
    const { message, id, properties } = params

    return this.fromDefault({
      message,
      properties: { id, ...properties },
    })
  }

  static withErrorAndId(params: LoggingDataParamsWithErrorAndId): object {
    const { message, id, error, properties } = params

    return this.fromDefault({
      message,
      properties: { id, error: error.toString(), ...properties },
    })
  }

  // New Enhanced Factory Methods for Datadog Integration

  /**
   * Factory method for intent operations (creation, fulfillment, validation, funding)
   */
  static forIntentOperation(params: IntentOperationLogParams): DatadogLogStructure {
    const ecoContext = this.createEcoContext(params)
    const metricsContext = this.createMetricsContext(params)
    const operationContext: OperationContext = {
      type: `intent_${params.operationType}`,
      status: params.status,
    }

    return this.createDatadogStructure(params.message, 'info', {
      eco: ecoContext,
      metrics: Object.keys(metricsContext).length > 0 ? metricsContext : undefined,
      operation: operationContext,
      ...params.properties,
    })
  }

  /**
   * Factory method for liquidity operations (rebalancing, liquidity provision, withdrawal)
   */
  static forLiquidityOperation(params: LiquidityOperationLogParams): DatadogLogStructure {
    const ecoContext = this.createEcoContext({
      rebalanceId: params.rebalanceId,
      walletAddress: params.walletAddress,
      strategy: params.strategy,
      sourceChainId: params.sourceChainId,
      destinationChainId: params.destinationChainId,
      rejectionReason: params.rejectionReason,
    })
    const metricsContext = this.createMetricsContext(params)
    const operationContext: OperationContext = {
      type: params.operationType,
      status: params.status,
    }

    return this.createDatadogStructure(params.message, 'info', {
      eco: ecoContext,
      metrics: Object.keys(metricsContext).length > 0 ? metricsContext : undefined,
      operation: operationContext,
      ...params.properties,
    })
  }

  /**
   * Factory method for quote generation operations
   */
  static forQuoteGeneration(params: QuoteGenerationLogParams): DatadogLogStructure {
    const ecoContext = this.createEcoContext(params)
    const metricsContext = this.createMetricsContext(params)
    const operationContext: OperationContext = {
      type: params.operationType,
      status: params.status,
    }

    return this.createDatadogStructure(params.message, 'info', {
      eco: ecoContext,
      metrics: Object.keys(metricsContext).length > 0 ? metricsContext : undefined,
      operation: operationContext,
      ...params.properties,
    })
  }

  /**
   * Factory method for performance metrics
   */
  static forPerformanceMetric(params: PerformanceMetricLogParams): DatadogLogStructure {
    const performanceContext: PerformanceContext = {
      response_time_ms: params.responseTimeMs,
      ...(params.queueDepth && { queue_depth: params.queueDepth }),
      ...(params.cpuUsage && { cpu_usage: params.cpuUsage }),
      ...(params.memoryUsage && { memory_usage: params.memoryUsage }),
      ...(params.activeConnections && { active_connections: params.activeConnections }),
    }
    const operationContext: OperationContext = {
      type: params.operationType,
    }

    return this.createDatadogStructure(params.message, 'info', {
      performance: performanceContext,
      operation: operationContext,
      ...params.properties,
    })
  }

  /**
   * Factory method for health check operations
   */
  static forHealthOperation(params: HealthOperationLogParams): DatadogLogStructure {
    const operationContext: OperationContext = {
      type: 'health_check',
      status: params.status,
    }

    const healthContext = {
      health_check: params.healthCheck,
      ...(params.responseTime && { response_time_ms: params.responseTime }),
      ...(params.dependencies && { dependencies: params.dependencies }),
    }

    const level: LogLevel =
      params.status === 'healthy' ? 'info' : params.status === 'degraded' ? 'warn' : 'error'

    return this.createDatadogStructure(params.message, level, {
      operation: operationContext,
      health: healthContext,
      ...params.properties,
    })
  }

  /**
   * Factory method for generic operations
   */
  static forGenericOperation(params: GenericOperationLogParams): DatadogLogStructure {
    const operationContext: OperationContext = {
      type: params.operationType,
      ...(params.status && { status: params.status }),
      ...(params.duration && { duration_ms: params.duration }),
    }

    return this.createDatadogStructure(params.message, 'info', {
      operation: operationContext,
      ...params.properties,
    })
  }

  /**
   * Factory method for transaction operations (blockchain transactions, signatures, smart wallet operations)
   */
  static forTransactionOperation(params: TransactionOperationLogParams): DatadogLogStructure {
    const ecoContext = this.createEcoContext({
      transactionHash: params.transactionHash,
      walletAddress: params.walletAddress,
      sourceChainId: params.chainId,
    })

    const metricsContext = this.createMetricsContext({
      gasUsed: params.gasUsed,
      gasPrice: params.gasPrice,
      blockNumber: params.blockNumber,
      nonce: params.nonce,
      transactionValue: params.value,
    })

    const operationContext: OperationContext = {
      type: params.operationType,
      status: params.status,
    }

    // Determine log level based on status
    const level: LogLevel =
      params.status === 'failed' ? 'error' : params.status === 'pending' ? 'info' : 'info'

    return this.createDatadogStructure(params.message, level, {
      eco: ecoContext,
      metrics: Object.keys(metricsContext).length > 0 ? metricsContext : undefined,
      operation: operationContext,
      transaction: {
        ...(params.to && { to_address: params.to }),
        ...(params.chainId && { chain_id: params.chainId }),
      },
      ...params.properties,
    })
  }

  /**
   * Enhanced error logging with structured error context
   */
  static withEnhancedError(
    message: string,
    error: EcoError,
    level: LogLevel = 'error',
    additionalContext?: object,
  ): DatadogLogStructure {
    const errorContext = this.createErrorContext(error)

    return this.createDatadogStructure(message, level, {
      error: errorContext,
      ...additionalContext,
    })
  }

  /**
   * Create a log entry with business context for debugging
   */
  static withBusinessContext(
    message: string,
    businessContext: Partial<EcoBusinessContext>,
    level: LogLevel = 'debug',
    additionalData?: object,
  ): DatadogLogStructure {
    return this.createDatadogStructure(message, level, {
      eco: businessContext,
      ...additionalData,
    })
  }
}
