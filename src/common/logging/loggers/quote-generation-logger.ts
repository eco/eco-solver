import { EcoLogMessage } from '../eco-log-message'
import { EcoError } from '../../errors/eco-error'
import { QuoteGenerationLogContext } from '../types'
import { BaseStructuredLogger } from './base-structured-logger'

/**
 * Specialized logger for quote generation processes
 */
export class QuoteGenerationLogger extends BaseStructuredLogger {
  constructor(context: string = 'QuoteGeneration') {
    super(context)
  }

  /**
   * Log a quote generation message with structured context
   */
  log(context: QuoteGenerationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.forQuoteGeneration({
      message,
      quoteId: context.quoteId,
      intentHash: context.intentHash,
      dAppId: context.dAppId,
      sourceChainId: context.sourceChainId,
      destinationChainId: context.destinationChainId,
      tokenInAddress: context.tokenInAddress,
      tokenOutAddress: context.tokenOutAddress,
      intentExecutionType: context.intentExecutionType,
      operationType: 'quote_generation',
      status: 'completed',
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log a quote generation error with structured context
   */
  error(
    context: QuoteGenerationLogContext,
    message: string,
    error?: Error,
    properties?: object,
  ): void {
    if (error && error instanceof EcoError) {
      const structure = EcoLogMessage.withEnhancedError(message, error, 'error', {
        eco: {
          quote_id: context.quoteId,
          intent_hash: context.intentHash,
          d_app_id: context.dAppId,
          source_chain_id: context.sourceChainId,
          destination_chain_id: context.destinationChainId,
          intent_execution_type: context.intentExecutionType,
        },
        ...properties,
      })
      this.logStructured(structure, 'error')
    } else {
      // Fallback for non-EcoError instances
      const structure = EcoLogMessage.forQuoteGeneration({
        message,
        quoteId: context.quoteId,
        intentHash: context.intentHash,
        dAppId: context.dAppId,
        sourceChainId: context.sourceChainId,
        destinationChainId: context.destinationChainId,
        operationType: 'quote_generation',
        status: 'failed',
        properties: { error: error?.toString(), ...properties },
      })
      this.logStructured(structure, 'error')
    }
  }

  /**
   * Log a quote generation warning with structured context
   */
  warn(context: QuoteGenerationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.withBusinessContext(
      message,
      {
        quote_id: context.quoteId,
        intent_hash: context.intentHash,
        d_app_id: context.dAppId,
        source_chain_id: context.sourceChainId,
        destination_chain_id: context.destinationChainId,
        intent_execution_type: context.intentExecutionType,
      },
      'warn',
      properties,
    )
    this.logStructured(structure, 'warn')
  }

  /**
   * Log a quote generation debug message with structured context
   */
  debug(context: QuoteGenerationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.withBusinessContext(
      message,
      {
        quote_id: context.quoteId,
        intent_hash: context.intentHash,
        d_app_id: context.dAppId,
        source_chain_id: context.sourceChainId,
        destination_chain_id: context.destinationChainId,
        intent_execution_type: context.intentExecutionType,
      },
      'debug',
      properties,
    )
    this.logStructured(structure, 'debug')
  }

  /**
   * Log successful quote generation
   */
  logQuoteGenerated(
    context: QuoteGenerationLogContext,
    amountIn: string,
    amountOut: string,
    properties?: object,
  ): void {
    const structure = EcoLogMessage.forQuoteGeneration({
      message: 'Quote generated successfully',
      quoteId: context.quoteId,
      intentHash: context.intentHash,
      dAppId: context.dAppId,
      sourceChainId: context.sourceChainId,
      destinationChainId: context.destinationChainId,
      tokenInAddress: context.tokenInAddress,
      tokenOutAddress: context.tokenOutAddress,
      amountIn,
      amountOut,
      intentExecutionType: context.intentExecutionType,
      operationType: 'quote_generation',
      status: 'completed',
      properties,
    })
    this.logStructured(structure, 'info')
  }
}
