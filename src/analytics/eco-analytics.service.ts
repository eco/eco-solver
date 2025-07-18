import { Injectable, Inject, Logger } from '@nestjs/common'
import { AnalyticsService, ANALYTICS_SERVICE } from '@/analytics'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { ANALYTICS_EVENTS, ERROR_EVENTS } from './events.constants'

/**
 * Centralized analytics service for the eco-solver application.
 * Handles all data extraction and event tracking to keep business logic clean.
 * All analytics operations are fire-and-forget to avoid blocking business logic.
 */
@Injectable()
export class EcoAnalyticsService {
  private readonly logger = new Logger(EcoAnalyticsService.name)

  constructor(@Inject(ANALYTICS_SERVICE) private readonly analytics: AnalyticsService) {}

  /**
   * Safe wrapper for analytics tracking that doesn't throw errors
   * @private
   */
  private safeTrack(eventName: string, data: Record<string, any>): void {
    this.analytics.trackEvent(eventName, data).catch((error) => {
      this.logger.warn(`Analytics tracking failed for event '${eventName}':`, error.message)
    })
  }

  /**
   * Public method for tracking success events
   */
  trackSuccess(eventName: string, data: Record<string, any>): void {
    this.safeTrack(eventName, data)
  }

  /**
   * Public method for tracking error events
   */
  trackError(eventName: string, error: any, data: Record<string, any>): void {
    this.safeTrack(eventName, {
      error,
      ...data,
    })
  }

  // ========== INTENT MODULE ANALYTICS ==========

  trackIntentDuplicateDetected(intent: any, model: any, intentWs: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.DUPLICATE_DETECTED, {
      intent,
      model,
      intentWs,
    })
  }

  trackIntentCreatedAndQueued(intent: any, jobId: string, intentWs: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CREATED_AND_QUEUED, {
      intent,
      intentWs,
      jobId,
    })
  }

  trackIntentCreatedWalletRejected(intent: any, intentWs: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CREATED_WALLET_REJECTED, {
      intent,
      intentWs,
    })
  }

  trackIntentCreationStarted(intent: any, intentWs: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CREATION_STARTED, {
      intent,
      intentWs,
    })
  }

  trackIntentCreationFailed(intent: any, intentWs: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CREATION_FAILED, {
      intent,
      intentWs,
      error,
    })
  }

  trackGaslessIntentCreated(
    intentHash: string,
    quoteID: string,
    funder: string,
    intent: any,
    route: any,
    reward: any,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.GASLESS_CREATED, {
      intentHash,
      quoteID,
      funder,
      intent,
      route,
      reward,
    })
  }

  trackGaslessIntentCreationStarted(
    intentHash: string,
    quoteID: string,
    funder: string,
    route: any,
    reward: any,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.GASLESS_CREATION_STARTED, {
      intentHash,
      quoteID,
      funder,
      route,
      reward,
    })
  }

  trackIntentValidationStarted(intentHash: string) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.VALIDATION_STARTED, {
      intentHash,
    })
  }

  trackIntentValidationFailed(
    intentHash: string,
    reason: string,
    stage: string,
    additionalData?: any,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.VALIDATION_FAILED, {
      intentHash,
      reason,
      stage,
      ...additionalData,
    })
  }

  trackIntentValidatedAndQueued(intentHash: string, jobId: string, model: IntentSourceModel) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.VALIDATED_AND_QUEUED, {
      intentHash,
      jobId,
      model,
    })
  }

  trackIntentFeasibleAndQueued(intentHash: string, jobId: string, model: IntentSourceModel) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FEASIBLE_AND_QUEUED, {
      intentHash,
      jobId,
      model,
    })
  }

  trackIntentInfeasible(intentHash: string, model: IntentSourceModel, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.INFEASIBLE, {
      intentHash,
      model,
      error,
    })
  }

  trackIntentFulfillmentMethodSelected(
    intentHash: string,
    fulfillmentType: string,
    isNativeIntent: boolean,
    model: IntentSourceModel,
    solver?: any,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FULFILLMENT_METHOD_SELECTED, {
      intentHash,
      fulfillmentType,
      isNativeIntent,
      model,
      solver,
    })
  }

  // ========== QUOTE MODULE ANALYTICS ==========

  trackQuoteRequestReceived(quoteIntentDataDTO: QuoteIntentDataDTO) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.REQUEST_RECEIVED, {
      quoteIntentDataDTO,
    })
  }

  trackQuoteResponseSuccess(
    quoteIntentDataDTO: QuoteIntentDataDTO,
    processingTime: number,
    quote: QuoteDataDTO,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.RESPONSE_SUCCESS, {
      quoteIntentDataDTO,
      quote,
      processingTimeMs: processingTime,
    })
  }

  trackQuoteResponseError(
    quoteIntentDataDTO: QuoteIntentDataDTO,
    processingTime: number,
    error: any,
    statusCode?: number,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.RESPONSE_ERROR, {
      quoteIntentDataDTO,
      error,
      processingTimeMs: processingTime,
      statusCode: statusCode || 500,
    })
  }

  trackQuoteProcessingStarted(quoteIntentDataDTO: QuoteIntentDataDTO, isReverseQuote: boolean) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.PROCESSING_STARTED, {
      quoteIntentDataDTO,
      isReverseQuote,
    })
  }

  trackQuoteProcessingSuccess(
    quoteIntentDataDTO: QuoteIntentDataDTO,
    isReverseQuote: boolean,
    successfulQuotes: number,
    totalErrors: number,
    processingTime: number,
    executionTypes: string[],
  ) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.PROCESSING_SUCCESS, {
      quoteIntentDataDTO,
      isReverseQuote,
      successfulQuotes,
      totalErrors,
      processingTimeMs: processingTime,
      executionTypes,
    })
  }

  trackQuoteStorageSuccess(quoteIntentDataDTO: QuoteIntentDataDTO, quoteIntents: any) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.STORAGE_SUCCESS, {
      quoteIntentDataDTO,
      quoteIntents,
    })
  }

  trackReverseQuoteRequestReceived(quoteIntentDataDTO: QuoteIntentDataDTO) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.REVERSE_REQUEST_RECEIVED, {
      quoteIntentDataDTO,
      timestamp: new Date().toISOString(),
    })
  }

  trackReverseQuoteResponseSuccess(
    quoteIntentDataDTO: QuoteIntentDataDTO,
    processingTime: number,
    quote: QuoteDataDTO,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.REVERSE_RESPONSE_SUCCESS, {
      quoteIntentDataDTO,
      quote,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    })
  }

  // ========== WATCH MODULE ANALYTICS ==========

  trackWatchCreateIntentSubscriptionStarted(sources: IntentSource[]) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.CREATE_INTENT_SUBSCRIPTION_STARTED, {
      sources,
    })
  }

  trackWatchCreateIntentSubscriptionSuccess(sources: IntentSource[]) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.CREATE_INTENT_SUBSCRIPTION_SUCCESS, {
      sources,
    })
  }

  trackWatchCreateIntentEventsDetected(eventCount: number, source: IntentSource) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.CREATE_INTENT_EVENTS_DETECTED, {
      eventCount,
      source,
    })
  }

  trackWatchCreateIntentJobQueued(createIntent: any, jobId: string, source: IntentSource) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.CREATE_INTENT_JOB_QUEUED, {
      createIntent,
      source,
      jobId,
    })
  }

  trackWatchIntentFundedEventsDetected(eventCount: number, source: IntentSource) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.INTENT_FUNDED_EVENTS_DETECTED, {
      eventCount,
      source,
    })
  }

  trackWatchIntentFundedJobQueued(intent: any, jobId: string, source: IntentSource) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.INTENT_FUNDED_JOB_QUEUED, {
      intent,
      source,
      jobId,
    })
  }

  trackWatchFulfillmentEventsDetected(eventCount: number, solver: any) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.FULFILLMENT_EVENTS_DETECTED, {
      eventCount,
      solver,
    })
  }

  trackWatchFulfillmentJobQueued(fulfillment: any, jobId: string, solver: any) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.FULFILLMENT_JOB_QUEUED, {
      fulfillment,
      solver,
      jobId,
    })
  }

  trackWatchErrorOccurred(error: any, serviceName: string, context: any) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.WATCH_ERROR_OCCURRED, {
      error,
      serviceName,
      context,
    })
  }

  trackWatchErrorRecoveryStarted(serviceName: string, context: any) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.WATCH_ERROR_RECOVERY_STARTED, {
      serviceName,
      context,
    })
  }

  trackWatchErrorRecoverySuccess(serviceName: string, context: any) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.WATCH_ERROR_RECOVERY_SUCCESS, {
      serviceName,
      context,
    })
  }

  trackWatchErrorRecoveryFailed(error: any, serviceName: string, context: any) {
    this.safeTrack(ANALYTICS_EVENTS.WATCH.WATCH_ERROR_RECOVERY_FAILED, {
      error,
      serviceName,
      context,
    })
  }

  // ========== ENHANCED TRACKING METHODS WITH FULL OBJECTS ==========

  /**
   * Track watch job queue failures with complete context objects
   */
  trackWatchJobQueueError(
    error: any,
    eventType: string,
    context: {
      intent?: any
      createIntent?: any
      fulfillment?: any
      intentHash?: string
      jobId: string
      source?: IntentSource
      solver?: any
      transactionHash?: string
      logIndex?: number
    },
  ) {
    this.safeTrack(eventType, {
      error,
      context,
    })
  }

  /**
   * Track gasless intent creation errors with complete context
   */
  trackGaslessIntentCreationError(
    error: any,
    quoteID: string,
    funder: string,
    route?: any,
    reward?: any,
  ) {
    this.safeTrack(ERROR_EVENTS.GASLESS_CREATION_FAILED, {
      error,
      quoteID,
      funder,
      route,
      reward,
    })
  }

  // ========== GENERIC ERROR TRACKING ==========

  // ========== WALLET FULFILLMENT SERVICE TRACKING ==========

  trackIntentFulfillmentStarted(intentHash: string) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FULFILLMENT_STARTED, {
      intentHash,
    })
  }

  trackIntentFulfillmentSuccess(model: any, solver: any, receipt: any, processingTime: number) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.WALLET_FULFILLMENT_SUCCESS, {
      model,
      solver,
      receipt,
      processingTimeMs: processingTime,
    })
  }

  trackIntentFulfillmentFailed(model: any, solver: any, error: any, processingTime: number) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.WALLET_FULFILLMENT_FAILED, {
      model,
      solver,
      error,
      processingTimeMs: processingTime,
    })
  }

  trackIntentFulfillmentTransactionReverted(model: any, solver: any, receipt: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.WALLET_FULFILLMENT_TRANSACTION_REVERTED, {
      model,
      solver,
      receipt,
    })
  }

  trackIntentFeasibilityCheckStarted(intentHash: string) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FEASIBILITY_CHECK_STARTED, {
      intentHash,
    })
  }

  trackIntentFeasibilityCheckSuccess(intent: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FEASIBILITY_CHECK_SUCCESS, {
      intent,
    })
  }

  trackIntentFeasibilityCheckFailed(intent: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FEASIBILITY_CHECK_FAILED, {
      intent,
      error,
    })
  }

  trackErc20TransactionHandlingSuccess(
    transactionTargetData: any,
    solver: any,
    target: any,
    result: any,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.ERC20_TRANSACTION_HANDLING_SUCCESS, {
      transactionTargetData,
      solver,
      target,
      result,
    })
  }

  trackErc20TransactionHandlingUnsupported(transactionTargetData: any, solver: any, target: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.ERC20_TRANSACTION_HANDLING_UNSUPPORTED, {
      transactionTargetData,
      solver,
      target,
    })
  }

  trackTransactionTargetGenerationSuccess(model: any, solver: any, functionFulfills: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.TRANSACTION_TARGET_GENERATION_SUCCESS, {
      model,
      solver,
      functionFulfills,
    })
  }

  trackTransactionTargetGenerationError(model: any, solver: any, call: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.TRANSACTION_TARGET_GENERATION_ERROR, {
      model,
      solver,
      call,
    })
  }

  trackTransactionTargetUnsupportedContractType(
    model: any,
    solver: any,
    transactionTargetData: any,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.TRANSACTION_TARGET_UNSUPPORTED_CONTRACT_TYPE, {
      model,
      solver,
      transactionTargetData,
    })
  }

  trackFulfillIntentTxCreationSuccess(
    model: any,
    inboxAddress: any,
    proverType: string,
    result: any,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FULFILL_INTENT_TX_CREATION_SUCCESS, {
      model,
      inboxAddress,
      proverType,
      result,
    })
  }

  trackFulfillIntentTxCreationFailed(model: any, inboxAddress: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FULFILL_INTENT_TX_CREATION_FAILED, {
      model,
      inboxAddress,
      error,
    })
  }

  // ========== UTILS INTENT SERVICE TRACKING ==========

  trackIntentStatusUpdate(model: any, status: string, reason?: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.INTENT_STATUS_UPDATE, {
      model,
      status,
      reason,
    })
  }

  trackFulfillmentProcessingSuccess(fulfillment: any, model: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FULFILLMENT_PROCESSING_SUCCESS, {
      fulfillment,
      model,
    })
  }

  trackFulfillmentProcessingIntentNotFound(fulfillment: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FULFILLMENT_PROCESSING_INTENT_NOT_FOUND, {
      fulfillment,
    })
  }

  trackFulfillmentProcessingError(fulfillment: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FULFILLMENT_PROCESSING_ERROR, {
      fulfillment,
      error,
    })
  }

  trackIntentProcessDataRetrievalSuccess(intentHash: string, model: any, solver: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.INTENT_PROCESS_DATA_RETRIEVAL_SUCCESS, {
      intentHash,
      model,
      solver,
    })
  }

  trackIntentProcessDataRetrievalModelNotFound(intentHash: string, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.INTENT_PROCESS_DATA_RETRIEVAL_MODEL_NOT_FOUND, {
      intentHash,
      error,
    })
  }

  trackIntentProcessDataRetrievalSolverNotFound(intentHash: string, model: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.INTENT_PROCESS_DATA_RETRIEVAL_SOLVER_NOT_FOUND, {
      intentHash,
      model,
    })
  }

  trackIntentProcessDataRetrievalError(intentHash: string, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.INTENT_PROCESS_DATA_RETRIEVAL_ERROR, {
      intentHash,
      error,
    })
  }

  trackSolverResolutionSuccess(destination: any, solver: any, opts?: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.SOLVER_RESOLUTION_SUCCESS, {
      destination,
      solver,
      opts,
    })
  }

  trackSolverResolutionNotFound(destination: any, opts?: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.SOLVER_RESOLUTION_NOT_FOUND, {
      destination,
      opts,
    })
  }

  // ========== CROWD LIQUIDITY SERVICE TRACKING ==========

  trackCrowdLiquidityFulfillmentSuccess(
    model: any,
    solver: any,
    result: any,
    processingTime: number,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_FULFILLMENT_SUCCESS, {
      model,
      solver,
      result,
      processingTimeMs: processingTime,
    })
  }

  trackCrowdLiquidityFulfillmentFailed(
    model: any,
    solver: any,
    error: any,
    processingTime: number,
  ) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_FULFILLMENT_FAILED, {
      model,
      solver,
      error,
      processingTimeMs: processingTime,
    })
  }

  trackCrowdLiquidityFulfillmentRewardNotEnough(model: any, solver: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_FULFILLMENT_REWARD_NOT_ENOUGH, {
      model,
      solver,
      error,
    })
  }

  trackCrowdLiquidityFulfillmentPoolNotSolvent(model: any, solver: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_FULFILLMENT_POOL_NOT_SOLVENT, {
      model,
      solver,
      error,
    })
  }

  trackCrowdLiquidityRebalanceSuccess(tokenIn: any, tokenOut: any, result: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_REBALANCE_SUCCESS, {
      tokenIn,
      tokenOut,
      result,
    })
  }

  trackCrowdLiquidityRebalanceError(tokenIn: any, tokenOut: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_REBALANCE_ERROR, {
      tokenIn,
      tokenOut,
      error,
    })
  }

  trackCrowdLiquidityRouteSupportCheck(intentModel: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_ROUTE_SUPPORT_CHECK, {
      intentModel,
    })
  }

  trackCrowdLiquidityRouteSupportResult(intentModel: any, isSupported: boolean, details: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_ROUTE_SUPPORT_RESULT, {
      intentModel,
      isSupported,
      details,
    })
  }

  trackCrowdLiquidityRewardCheck(intentModel: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_REWARD_CHECK, {
      intentModel,
    })
  }

  trackCrowdLiquidityRewardCheckResult(intentModel: any, isEnough: boolean, details: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_REWARD_CHECK_RESULT, {
      intentModel,
      isEnough,
      details,
    })
  }

  trackCrowdLiquidityPoolSolvencyCheck(intentModel: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_POOL_SOLVENCY_CHECK, {
      intentModel,
    })
  }

  trackCrowdLiquidityPoolSolvencyResult(intentModel: any, isSolvent: boolean, details: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_POOL_SOLVENCY_RESULT, {
      intentModel,
      isSolvent,
      details,
    })
  }

  trackCrowdLiquidityPoolSolvencyError(intentModel: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_POOL_SOLVENCY_ERROR, {
      intentModel,
      error,
    })
  }

  trackCrowdLiquidityLitActionSuccess(ipfsId: string, params: any, result: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_LIT_ACTION_SUCCESS, {
      ipfsId,
      params,
      result,
    })
  }

  trackCrowdLiquidityLitActionError(ipfsId: string, params: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_LIT_ACTION_ERROR, {
      ipfsId,
      params,
      error,
    })
  }

  // ========== CREATE INTENT SERVICE TRACKING ==========

  trackIntentRetrievalSuccess(method: string, context: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.INTENT_RETRIEVAL_SUCCESS, {
      method,
      context,
    })
  }

  trackIntentRetrievalNotFound(method: string, context: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.INTENT_RETRIEVAL_NOT_FOUND, {
      method,
      context,
      error,
    })
  }

  trackIntentRetrievalError(method: string, error: any, context: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.INTENT_RETRIEVAL_ERROR, {
      method,
      error,
      context,
    })
  }

  // ========== FEASABLE INTENT SERVICE TRACKING ==========

  trackQuoteFeasibilityCheckSuccess(quoteIntent: any) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.FEASIBILITY_CHECK_SUCCESS, {
      quoteIntent,
    })
  }

  trackQuoteFeasibilityCheckError(quoteIntent: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.FEASIBILITY_CHECK_ERROR, {
      quoteIntent,
      error,
    })
  }

  // ========== GENERIC SUCCESS TRACKING ==========

  // ========== CONTROLLER REQUEST/RESPONSE TRACKING ==========

  trackHealthRequestReceived(endpoint: string, requestData: any) {
    this.safeTrack('health_request_received', {
      endpoint,
      requestData,
    })
  }

  trackHealthResponseSuccess(endpoint: string, responseData: any) {
    this.safeTrack('health_response_success', {
      endpoint,
      responseData,
    })
  }

  trackHealthResponseError(endpoint: string, error: any, context: any) {
    this.safeTrack('health_response_error', {
      endpoint,
      error,
      context,
    })
  }

  // ========== JOB PROCESSING TRACKING ==========

  trackJobCompleted(jobName: string, jobContext: any) {
    this.safeTrack('job_completed', {
      jobName,
      jobContext,
    })
  }

  trackJobFailed(jobName: string, error: any, jobContext: any) {
    this.safeTrack('job_failed', {
      jobName,
      error,
      jobContext,
    })
  }
}
