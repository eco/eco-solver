import { EcoError } from '../../errors/eco-error'
import { EcoLogMessage } from '../eco-log-message'
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
  ): void
  logIntentCreation(
    context: IntentOperationLogContext,
    amountIn: string,
    amountOut: string,
    tokenInAddress: string,
    tokenOutAddress: string,
    routeTokens: Array<{ token: string; amount: string }>,
    rewardTokens: Array<{ token: string; amount: string }>,
    properties?: object,
  ): void
  logIntentCreation(
    context: IntentOperationLogContext,
    amountIn: string,
    amountOut: string,
    tokenInAddress: string,
    tokenOutAddress: string,
    routeTokensOrProperties?: Array<{ token: string; amount: string }> | object,
    rewardTokens?: Array<{ token: string; amount: string }>,
    properties?: object,
  ): void {
    // Handle overloaded parameters
    let finalRouteTokens: Array<{ token: string; amount: string }> | undefined
    let finalRewardTokens: Array<{ token: string; amount: string }> | undefined
    let finalProperties: object | undefined

    if (Array.isArray(routeTokensOrProperties)) {
      finalRouteTokens = routeTokensOrProperties
      finalRewardTokens = rewardTokens
      finalProperties = properties
    } else {
      finalRouteTokens = undefined
      finalRewardTokens = undefined
      finalProperties = routeTokensOrProperties
    }

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
      routeTokens: finalRouteTokens,
      rewardTokens: finalRewardTokens,
      operationType: 'creation',
      status: 'completed',
      properties: finalProperties,
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

  /**
   * Log intent not found during fulfillment processing
   */
  logFulfillmentProcessingIntentNotFound(intentHash: string, reason: string): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      fulfillment_processing: {
        not_found_reason: reason,
        processing_stage: 'intent_lookup',
      },
      operation: {
        business_event: 'fulfillment_processing_intent_not_found',
        action_taken: 'abort_processing',
      },
    }

    this.logMessage(context, 'warn', `Intent not found during fulfillment processing: ${reason}`)
  }

  /**
   * Log process data retrieval errors
   */
  logProcessDataRetrievalError(intentHash: string, error: Error, dataType: string): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      data_retrieval: {
        data_type: dataType,
        error_message: error.message,
        retrieval_stage: 'process_data_fetch',
      },
      operation: {
        business_event: 'process_data_retrieval_error',
        action_taken: 'return_error_response',
      },
    }

    this.logMessage(
      context,
      'error',
      `Process data retrieval failed for ${dataType}: ${error.message}`,
    )
  }

  /**
   * Log solver resolution results
   */
  logSolverResolutionResult(
    intentHash: string,
    solver: any,
    resolved: boolean,
    reason?: string,
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      solver_resolution: {
        solver_id: solver?.id || solver?.name,
        resolution_result: resolved ? 'resolved' : 'not_resolved',
        resolution_reason: reason,
      },
      operation: {
        business_event: 'solver_resolution_attempted',
        action_taken: resolved ? 'assign_solver' : 'try_next_solver',
      },
    }

    const message = resolved
      ? `Solver resolution successful: ${solver?.id || solver?.name}`
      : `Solver resolution failed: ${reason}`
    this.logMessage(context, resolved ? 'info' : 'warn', message)
  }

  // ================== NEW BUSINESS EVENT METHODS ==================

  /**
   * Log transaction target generation results
   */
  logTransactionTargetGeneration(intentHash: string, targetCount: number, success: boolean): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      transaction_generation: {
        target_count: targetCount,
        generation_result: success ? 'success' : 'failure',
        generation_stage: 'transaction_target_creation',
      },
      operation: {
        business_event: 'transaction_target_generation',
        action_taken: success ? 'proceed_with_fulfillment' : 'abort_fulfillment',
      },
    }

    this.logMessage(
      context,
      success ? 'debug' : 'error',
      `Transaction target generation ${success ? 'succeeded' : 'failed'}: ${targetCount} targets`,
    )
  }

  /**
   * Log ERC20 token handling results
   */
  logErc20TokenHandling(
    intentHash: string,
    tokenAddress: string,
    operation: string,
    success: boolean,
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
        token_address: tokenAddress,
      },
      erc20_handling: {
        operation_type: operation,
        handling_result: success ? 'success' : 'failure',
        handling_stage: 'erc20_transaction_preparation',
      },
      operation: {
        business_event: 'erc20_token_handling',
        action_taken: success ? 'create_approval_transaction' : 'skip_token_handling',
      },
    }

    this.logMessage(
      context,
      success ? 'debug' : 'warn',
      `ERC20 token handling (${operation}) ${success ? 'succeeded' : 'failed'} for ${tokenAddress}`,
    )
  }

  /**
   * Log native fulfill calculation results
   */
  logNativeFulfillCalculation(intentHash: string, totalValue: bigint, callCount: number): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      native_calculation: {
        total_native_value: totalValue.toString(),
        native_calls_count: callCount,
        calculation_stage: 'native_fulfill_preparation',
      },
      operation: {
        business_event: 'native_fulfill_calculated',
        action_taken: 'prepare_native_transfer',
      },
    }

    this.logMessage(
      context,
      'debug',
      `Native fulfill calculation: ${totalValue.toString()} wei from ${callCount} calls`,
    )
  }

  /**
   * Log crowd liquidity pool solvency check
   */
  logCrowdLiquidityPoolSolvency(intentHash: string, solvent: boolean, poolAddress: string): void {
    const context = {
      eco: {
        intent_hash: intentHash,
        pool_address: poolAddress,
      },
      pool_solvency: {
        is_solvent: solvent,
        solvency_check_stage: 'pool_balance_validation',
        solvency_reason: solvent ? 'sufficient_pool_balance' : 'insufficient_pool_balance',
      },
      operation: {
        business_event: 'crowd_liquidity_pool_solvency_check',
        action_taken: solvent ? 'proceed_with_crowd_liquidity' : 'fallback_to_solver',
      },
    }

    this.logMessage(
      context,
      solvent ? 'debug' : 'warn',
      `Crowd liquidity pool solvency: ${solvent ? 'solvent' : 'insolvent'}`,
    )
  }

  /**
   * Log LIT action execution result (enhanced version)
   */
  logLitActionResult(actionId: string, success: boolean, response: string, context?: object): void {
    const logContext = {
      lit_action: {
        action_id: actionId,
        execution_result: success ? 'success' : 'failure',
        response_data: response,
        execution_stage: 'lit_protocol_execution',
      },
      operation: {
        business_event: 'lit_action_executed',
        action_taken: success ? 'process_transaction_response' : 'handle_lit_action_error',
      },
      ...context,
    }

    this.logMessage(
      logContext,
      success ? 'info' : 'error',
      `LIT action ${actionId} ${success ? 'executed successfully' : 'failed'}: ${response}`,
    )
  }

  /**
   * Log token support validation results
   */
  logTokenSupportValidation(tokenAddress: string, chainId: number, supported: boolean): void {
    const context = {
      eco: {
        token_address: tokenAddress,
        chain_id: chainId,
      },
      token_validation: {
        is_supported: supported,
        validation_stage: 'token_support_check',
        validation_reason: supported ? 'token_in_supported_list' : 'token_not_in_supported_list',
      },
      operation: {
        business_event: 'token_support_validation',
        action_taken: supported ? 'proceed_with_token' : 'reject_token',
      },
    }

    this.logMessage(
      context,
      supported ? 'debug' : 'warn',
      `Token support validation: ${tokenAddress} on chain ${chainId} is ${supported ? 'supported' : 'not supported'}`,
    )
  }

  /**
   * Log prover fee calculation results
   */
  logProverFeeCalculation(
    intentHash: string,
    proverAddr: string,
    fee: bigint,
    success: boolean,
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
        prover_address: proverAddr,
      },
      prover_fee: {
        calculated_fee: fee.toString(),
        calculation_result: success ? 'success' : 'failure',
        calculation_stage: 'prover_fee_estimation',
      },
      operation: {
        business_event: 'prover_fee_calculated',
        action_taken: success ? 'use_calculated_fee' : 'fallback_fee_estimation',
      },
    }

    this.logMessage(
      context,
      success ? 'debug' : 'error',
      `Prover fee calculation ${success ? 'succeeded' : 'failed'}: ${fee.toString()} wei`,
    )
  }

  /**
   * Log fulfillment method selection
   */
  logFulfillmentMethodSelection(
    intentHash: string,
    method: 'wallet' | 'crowd-liquidity',
    reason?: string,
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      fulfillment_method: {
        selected_method: method,
        selection_reason: reason || 'default_selection',
        selection_stage: 'fulfillment_orchestration',
      },
      operation: {
        business_event: 'fulfillment_method_selected',
        action_taken:
          method === 'crowd-liquidity' ? 'execute_crowd_liquidity' : 'execute_wallet_fulfillment',
      },
    }

    this.logMessage(
      context,
      'info',
      `Fulfillment method selected: ${method}${reason ? ` (${reason})` : ''}`,
    )
  }
}
