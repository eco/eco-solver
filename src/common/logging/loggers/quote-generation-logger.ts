import { EcoLogMessage } from '../eco-log-message'
import { EcoError } from '../../errors/eco-error'
import { QuoteGenerationLogContext } from '../types'
import { BaseStructuredLogger } from './base-structured-logger'
import { extractQuoteContext, mergeContexts } from '../decorators/context-extractors'

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

  // ================== BUSINESS EVENT METHODS ==================

  /**
   * Log quote generation method selection
   */
  logQuoteGenerationMethodSelected(
    quoteType: 'standard' | 'reverse',
    dAppId: string,
    intentExecutionType?: string,
  ): void {
    const context = {
      eco: {
        d_app_id: dAppId,
        quote_id: 'quote-request',
      },
      quote_generation: {
        quote_type: quoteType,
        intent_execution_type: intentExecutionType || 'unknown',
        generation_method: `${quoteType}_quote_generation`,
      },
      operation: {
        business_event: 'quote_generation_method_selected',
        action_taken: 'process_quote_request',
      },
    }

    this.logMessage(context, 'debug', `Quote generation method selected: ${quoteType}`)
  }

  /**
   * Log quote feasibility check results
   */
  logQuoteFeasibilityResult(quoteId: string, feasible: boolean, reason?: string): void {
    const context = {
      eco: {
        quote_id: quoteId,
      },
      feasibility_check: {
        is_feasible: feasible,
        check_reason: reason || 'not_specified',
        check_stage: 'quote_validation',
      },
      operation: {
        business_event: 'quote_feasibility_checked',
        action_taken: feasible ? 'proceed_with_quote' : 'reject_quote',
      },
    }

    const message = feasible ? 'Quote feasibility: passed' : `Quote feasibility: failed (${reason})`
    this.logMessage(context, feasible ? 'debug' : 'warn', message)
  }

  /**
   * Log quote validation failures
   */
  logQuoteValidationFailure(
    quote: any,
    validationType: 'transaction_validation' | 'feasibility_check',
    error: any,
  ): void {
    const context = mergeContexts(extractQuoteContext(quote), {
      quote_validation: {
        validation_type: validationType,
        validation_stage: 'quote_processing',
        failure_reason: error?.message || 'unknown_error',
        error_code: error?.code,
      },
      operation: {
        business_event: 'quote_validation_failed',
        action_taken: 'reject_quote',
      },
    })

    this.logMessage(
      context,
      'error',
      `Quote validation failed (${validationType}): ${error?.message}`,
    )
  }

  /**
   * Log quote processing completion
   */
  logQuoteProcessingResult(
    quoteType: 'standard' | 'reverse',
    success: boolean,
    processingTimeMs?: number,
    error?: any,
  ): void {
    const context = {
      eco: {
        quote_id: 'quote-processing',
      },
      quote_processing: {
        quote_type: quoteType,
        processing_success: success,
        processing_time_ms: processingTimeMs,
        failure_reason: error?.message,
      },
      operation: {
        business_event: 'quote_processing_completed',
        action_taken: success ? 'return_quote' : 'return_error',
      },
      performance: {
        processing_time_ms: processingTimeMs,
      },
    }

    const message = success
      ? `Quote processing completed successfully (${quoteType})`
      : `Quote processing failed (${quoteType}): ${error?.message}`

    this.logMessage(context, success ? 'info' : 'error', message)
  }

  /**
   * Log quote rejection due to specific business rules
   */
  logQuoteBusinessRejection(
    quoteId: string,
    rejectionReason: string,
    businessRule: string,
    details?: Record<string, any>,
  ): void {
    const context = {
      eco: {
        quote_id: quoteId,
      },
      quote_rejection: {
        rejection_reason: rejectionReason,
        business_rule: businessRule,
        rejection_stage: 'business_validation',
        ...details,
      },
      operation: {
        business_event: 'quote_business_rejection',
        action_taken: 'return_rejection_response',
      },
    }

    this.logMessage(
      context,
      'warn',
      `Quote rejected by business rule (${businessRule}): ${rejectionReason}`,
    )
  }

  /**
   * Log transaction validation results
   */
  logTransactionValidationResult(
    quoteId: string,
    transactionValid: boolean,
    validationType: string,
    transactionData?: any,
  ): void {
    const context = {
      eco: {
        quote_id: quoteId,
      },
      transaction_validation: {
        transaction_valid: transactionValid,
        validation_type: validationType,
        validation_stage: 'transaction_processing',
        transaction_function: transactionData?.decodedFunctionData?.functionName,
      },
      operation: {
        business_event: 'transaction_validation_completed',
        action_taken: transactionValid ? 'proceed_with_transaction' : 'reject_transaction',
      },
    }

    const message = transactionValid
      ? `Transaction validation passed (${validationType})`
      : `Transaction validation failed (${validationType})`

    this.logMessage(context, transactionValid ? 'debug' : 'warn', message)
  }
}
