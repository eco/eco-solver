import { Injectable, Inject, Logger } from '@nestjs/common'
import { AnalyticsService, ANALYTICS_SERVICE } from '@/analytics'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
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

  // ========== INTENT MODULE ANALYTICS ==========

  trackIntentCreationStarted(intent: any, intentWs: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CREATION_STARTED, {
      intent,
      intentWs,
    })
  }

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

  trackIntentCreationFailed(intent: any, intentWs: any, error: any) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.CREATION_FAILED, {
      intent,
      intentWs,
      error,
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

  trackIntentValidationStarted(intentHash: string) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.VALIDATION_STARTED, { intentHash })
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

  trackIntentFeasibilityCheckStarted(intentHash: string) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FEASIBILITY_CHECK_STARTED, {
      intentHash,
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

  trackIntentFulfillmentStarted(intentHash: string) {
    this.safeTrack(ANALYTICS_EVENTS.INTENT.FULFILLMENT_STARTED, { intentHash })
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

  trackQuoteStorageSuccess(
    quoteIntentDataDTO: QuoteIntentDataDTO,
    quoteIntents: QuoteIntentModel[],
  ) {
    this.safeTrack(ANALYTICS_EVENTS.QUOTE.STORAGE_SUCCESS, {
      quoteIntentDataDTO,
      quoteIntents,
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

  trackError(eventName: string, error: any, context?: Record<string, any>) {
    this.safeTrack(eventName, {
      error,
      ...context,
    })
  }

  // ========== GENERIC SUCCESS TRACKING ==========

  trackSuccess(eventName: string, context?: Record<string, any>) {
    this.safeTrack(eventName, context || {})
  }

  // ========== CONTROLLER REQUEST/RESPONSE TRACKING ==========

  trackRequestReceived(endpoint: string, requestData: any) {
    this.safeTrack('request_received', {
      endpoint,
      requestData,
    })
  }

  trackResponseSuccess(endpoint: string, responseData: any) {
    this.safeTrack('response_success', {
      endpoint,
      responseData,
    })
  }

  trackResponseError(endpoint: string, error: any, context: any) {
    this.safeTrack('response_error', {
      endpoint,
      error,
      context,
    })
  }

  // ========== DATABASE OPERATION TRACKING ==========

  trackDatabaseQuery(operation: string, queryData: any) {
    this.safeTrack('database_query', {
      operation,
      queryData,
    })
  }

  trackDatabaseError(operation: string, error: any, context: any) {
    this.safeTrack('database_error', {
      operation,
      error,
      context,
    })
  }

  // ========== JOB PROCESSING TRACKING ==========

  trackJobStarted(jobName: string, jobContext: any) {
    this.safeTrack('job_started', {
      jobName,
      jobContext,
    })
  }

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
