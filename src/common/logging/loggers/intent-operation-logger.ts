import { EcoLogMessage } from '../eco-log-message'
import { EcoError } from '../../errors/eco-error'
import { IntentOperationLogContext } from '../types'
import { BaseStructuredLogger } from './base-structured-logger'
import { extractIntentContext, mergeContexts } from '../decorators/context-extractors'

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

  // ================== BUSINESS EVENT METHODS ==================

  /**
   * Log duplicate intent detection with full context
   */
  logDuplicateIntentDetected(existingModel: any, newIntent: any, eventContext?: any): void {
    const context = mergeContexts(
      extractIntentContext(newIntent),
      {
        eco: {
          existing_intent_status: existingModel.status,
          existing_intent_created: existingModel.createdAt?.toISOString(),
          duplicate_detection_reason: 'intent_hash_collision',
        },
        operation: {
          business_event: 'duplicate_intent_detected',
          action_taken: 'early_return_no_processing',
        },
      },
      eventContext ? { event: eventContext } : {},
    )

    this.logMessage(context, 'info', 'Duplicate intent detected - skipping processing')
  }

  /**
   * Log intent validation failure with detailed reasons
   */
  logValidationFailure(intent: any, validationResults: any, failedChecks: string[]): void {
    const context = mergeContexts(extractIntentContext(intent), {
      validation: {
        failed_checks: failedChecks,
        total_checks: Object.keys(validationResults).length,
        failed_check_count: failedChecks.length,
        validation_stage: 'assert_validations',
      },
      operation: {
        business_event: 'intent_validation_failed',
        action_taken: 'marked_invalid_status',
      },
    })

    this.logMessage(context, 'warn', `Intent validation failed: ${failedChecks.join(', ')}`)
  }

  /**
   * Log funding check retry attempts
   */
  logFundingCheckRetry(
    intentHash: string,
    retryCount: number,
    maxRetries: number,
    sourceChainId: number,
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
        source_chain_id: sourceChainId,
      },
      retry: {
        attempt: retryCount,
        max_attempts: maxRetries,
        retry_reason: 'intent_not_funded',
        retry_stage: 'funding_verification',
      },
      operation: {
        business_event: 'intent_funding_check_retry',
        action_taken: 'retry_funding_verification',
      },
    }

    this.logMessage(context, 'debug', `Intent funding check retry ${retryCount}/${maxRetries}`)
  }

  /**
   * Log intent status transitions
   */
  logIntentStatusTransition(
    intentHash: string,
    fromStatus: string,
    toStatus: string,
    reason: string,
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      status_transition: {
        from_status: fromStatus,
        to_status: toStatus,
        transition_reason: reason,
        timestamp: new Date().toISOString(),
      },
      operation: {
        business_event: 'intent_status_transition',
        action_taken: 'status_updated',
      },
    }

    this.logMessage(context, 'info', `Intent status: ${fromStatus} → ${toStatus} (${reason})`)
  }

  /**
   * Log crowd liquidity fulfillment method selection
   */
  logCrowdLiquidityMethodSelected(
    intentHash: string,
    isRouteSupported: boolean,
    fallbackReason?: string,
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      fulfillment_method: {
        selected_method: isRouteSupported ? 'crowd_liquidity' : 'solver_fulfillment',
        route_supported: isRouteSupported,
        fallback_reason: fallbackReason || null,
        selection_stage: 'fulfillment_orchestration',
      },
      operation: {
        business_event: 'fulfillment_method_selected',
        action_taken: isRouteSupported ? 'execute_crowd_liquidity' : 'fallback_to_solver',
      },
    }

    const message = isRouteSupported
      ? 'Fulfillment method: crowd liquidity selected'
      : `Fulfillment method: falling back to solver (${fallbackReason})`

    this.logMessage(context, 'info', message)
  }

  /**
   * Log feasibility check failures
   */
  logFeasibilityCheckFailure(
    intent: any,
    checkType: 'final_feasibility' | 'route_feasibility',
    error: any,
  ): void {
    const context = mergeContexts(extractIntentContext(intent), {
      feasibility_check: {
        check_type: checkType,
        check_stage: 'pre_fulfillment',
        failure_reason: error?.message || 'unknown_error',
        error_code: error?.code,
      },
      operation: {
        business_event: 'feasibility_check_failed',
        action_taken: 'abort_fulfillment',
      },
    })

    this.logMessage(context, 'error', `Feasibility check failed (${checkType}): ${error?.message}`)
  }

  /**
   * Log gasless intent support check results
   */
  logGaslessIntentSupportCheck(
    dAppId: string,
    supported: boolean,
    supportedDAppsCount: number,
  ): void {
    const context = {
      eco: {
        d_app_id: dAppId,
      },
      gasless_check: {
        supported: supported,
        reason: supported ? 'dapp_in_allowlist' : 'dapp_not_in_allowlist',
        supported_dapps: supportedDAppsCount,
      },
      operation: {
        business_event: 'gasless_intent_support_check',
        action_taken: supported ? 'proceed_with_gasless' : 'reject_gasless_request',
      },
    }

    const message = supported
      ? `Gasless intent supported for dAppID: ${dAppId}`
      : `Gasless intent not supported for dAppID: ${dAppId}`

    this.logMessage(context, supported ? 'debug' : 'warn', message)
  }

  /**
   * Log permit validation results
   */
  logPermitValidationResult(
    intentHash: string,
    validationType: 'permit_simulation' | 'vault_funding',
    success: boolean,
    error?: any,
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      permit_validation: {
        validation_type: validationType,
        validation_stage: 'permit_processing',
        validation_result: success ? 'success' : 'failure',
        failure_reason: error?.message,
      },
      operation: {
        business_event: success ? 'permit_validation_success' : 'permit_validation_failed',
        action_taken: success ? 'proceed_with_intent' : 'return_validation_error',
      },
    }

    const message = success
      ? `Permit validation successful: ${validationType}`
      : `Permit validation failed (${validationType}): ${error?.message}`

    this.logMessage(context, success ? 'debug' : 'error', message)
  }

  /**
   * Log intent creation failures
   */
  logIntentCreationFailure(intent: any, error: Error, eventContext?: any): void {
    const context = mergeContexts(extractIntentContext(intent), {
      intent_creation: {
        creation_stage: 'database_insert',
        failure_reason: error.message,
        error_code: error.name,
      },
      operation: {
        business_event: 'intent_creation_failed',
        action_taken: 'return_creation_error',
      },
      event_context: eventContext,
    })

    this.logMessage(context, 'error', `Intent creation failed: ${error.message}`)
  }

  /**
   * Log gasless intent creation failures
   */
  logGaslessIntentCreationFailure(
    quoteID: string,
    funder: string,
    route: any,
    reward: any,
    error: Error,
  ): void {
    const context = {
      eco: {
        quote_id: quoteID,
        wallet_address: funder,
        source_chain_id: route?.source,
        destination_chain_id: route?.destination,
      },
      gasless_intent_creation: {
        creation_stage: 'database_insert',
        failure_reason: error.message,
        error_code: error.name,
        route_type: 'gasless_intent',
      },
      operation: {
        business_event: 'gasless_intent_creation_failed',
        action_taken: 'return_creation_error',
      },
    }

    this.logMessage(context, 'error', `Gasless intent creation failed: ${error.message}`)
  }

  /**
   * Log feasibility check results
   */
  logFeasibilityCheckResult(intentHash: string, feasible: boolean, reason?: string): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      feasibility_check: {
        is_feasible: feasible,
        check_reason: reason || 'not_specified',
        check_stage: 'intent_feasibility_validation',
      },
      operation: {
        business_event: 'intent_feasibility_checked',
        action_taken: feasible ? 'proceed_with_fulfillment' : 'reject_intent',
      },
    }

    const message = feasible
      ? 'Intent feasibility: passed'
      : `Intent feasibility: failed (${reason})`
    this.logMessage(context, feasible ? 'debug' : 'warn', message)
  }
}
