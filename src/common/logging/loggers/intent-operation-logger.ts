import { EcoLogMessage } from '../eco-log-message'
import { EcoError } from '../../errors/eco-error'
import { IntentOperationLogContext } from '../types'
import { BaseStructuredLogger } from './base-structured-logger'

/**
 * Specialized logger for intent-related operations
 */
export class IntentOperationLogger extends BaseStructuredLogger {
  constructor(context: string = 'IntentOperation') {
    super(context)
  }

  /**
   * Log an intent operation message with structured context
   */
  log(context: IntentOperationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.forIntentOperation({
      message,
      intentHash: context.intentHash,
      quoteId: context.quoteId,
      creator: context.creator,
      dAppId: context.dAppId,
      sourceChainId: context.sourceChainId,
      destinationChainId: context.destinationChainId,
      operationType: context.operationType || 'creation',
      status: 'completed',
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log an intent operation error with structured context
   */
  error(
    context: IntentOperationLogContext,
    message: string,
    error?: Error,
    properties?: object,
  ): void {
    if (error && error instanceof EcoError) {
      const structure = EcoLogMessage.withEnhancedError(message, error, 'error', {
        eco: {
          intent_hash: context.intentHash,
          quote_id: context.quoteId,
          creator: context.creator,
          d_app_id: context.dAppId,
          source_chain_id: context.sourceChainId,
          destination_chain_id: context.destinationChainId,
        },
        ...properties,
      })
      this.logStructured(structure, 'error')
    } else {
      // Fallback for non-EcoError instances
      const structure = EcoLogMessage.forIntentOperation({
        message,
        intentHash: context.intentHash,
        quoteId: context.quoteId,
        creator: context.creator,
        dAppId: context.dAppId,
        sourceChainId: context.sourceChainId,
        destinationChainId: context.destinationChainId,
        operationType: context.operationType || 'creation',
        status: 'failed',
        properties: { error: error?.toString(), ...properties },
      })
      this.logStructured(structure, 'error')
    }
  }

  /**
   * Log an intent operation warning with structured context
   */
  warn(context: IntentOperationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.withBusinessContext(
      message,
      {
        intent_hash: context.intentHash,
        quote_id: context.quoteId,
        creator: context.creator,
        d_app_id: context.dAppId,
        source_chain_id: context.sourceChainId,
        destination_chain_id: context.destinationChainId,
      },
      'warn',
      properties,
    )
    this.logStructured(structure, 'warn')
  }

  /**
   * Log an intent operation debug message with structured context
   */
  debug(context: IntentOperationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.withBusinessContext(
      message,
      {
        intent_hash: context.intentHash,
        quote_id: context.quoteId,
        creator: context.creator,
        d_app_id: context.dAppId,
        source_chain_id: context.sourceChainId,
        destination_chain_id: context.destinationChainId,
      },
      'debug',
      properties,
    )
    this.logStructured(structure, 'debug')
  }

  /**
   * Log intent creation
   */
  logIntentCreation(
    context: IntentOperationLogContext,
    amountIn: string,
    amountOut: string,
    tokenInAddress: string,
    tokenOutAddress: string,
    properties?: object,
  ): void {
    const structure = EcoLogMessage.forIntentOperation({
      message: 'Intent created successfully',
      intentHash: context.intentHash,
      quoteId: context.quoteId,
      creator: context.creator,
      dAppId: context.dAppId,
      sourceChainId: context.sourceChainId,
      destinationChainId: context.destinationChainId,
      tokenInAddress,
      tokenOutAddress,
      amountIn,
      amountOut,
      operationType: 'creation',
      status: 'completed',
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log intent fulfillment
   */
  logIntentFulfillment(context: IntentOperationLogContext, properties?: object): void {
    const structure = EcoLogMessage.forIntentOperation({
      message: 'Intent fulfilled successfully',
      intentHash: context.intentHash,
      quoteId: context.quoteId,
      creator: context.creator,
      dAppId: context.dAppId,
      sourceChainId: context.sourceChainId,
      destinationChainId: context.destinationChainId,
      operationType: 'fulfillment',
      status: 'completed',
      properties,
    })
    this.logStructured(structure, 'info')
  }
}
