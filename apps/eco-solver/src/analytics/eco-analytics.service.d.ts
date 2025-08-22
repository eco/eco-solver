import { AnalyticsService } from './analytics.interface';
import { IntentSourceModel } from '@eco-solver/intent/schemas/intent-source.schema';
import { QuoteIntentDataDTO } from '@eco-solver/quote/dto/quote.intent.data.dto';
import { QuoteDataDTO } from '@eco-solver/quote/dto/quote-data.dto';
import { IntentSource } from '@libs/solver-config';
/**
 * Centralized analytics service for the eco-solver application.
 * Handles all data extraction and event tracking to keep business logic clean.
 * All analytics operations are fire-and-forget to avoid blocking business logic.
 */
export declare class EcoAnalyticsService {
    private readonly analytics;
    private readonly logger;
    constructor(analytics: AnalyticsService);
    /**
     * Safe wrapper for analytics tracking that doesn't throw errors
     * @private
     */
    private safeTrack;
    /**
     * Public method for tracking success events
     */
    trackSuccess(eventName: string, data: Record<string, any>): void;
    /**
     * Public method for tracking error events
     */
    trackError(eventName: string, error: any, data: Record<string, any>): void;
    trackIntentDuplicateDetected(intent: any, model: any, intentWs: any): void;
    trackIntentCreatedAndQueued(intent: any, jobId: string, intentWs: any): void;
    trackIntentCreatedWalletRejected(intent: any, intentWs: any): void;
    trackIntentCreationStarted(intent: any, intentWs: any): void;
    trackIntentCreationFailed(intent: any, intentWs: any, error: any): void;
    trackGaslessIntentCreated(intentHash: string, quoteID: string, funder: string, intent: any, route: any, reward: any): void;
    trackGaslessIntentCreationStarted(intentHash: string, quoteID: string, funder: string, route: any, reward: any): void;
    trackIntentValidationStarted(intentHash: string): void;
    trackIntentValidationFailed(intentHash: string, reason: string, stage: string, additionalData?: any): void;
    trackIntentValidatedAndQueued(intentHash: string, jobId: string, model: IntentSourceModel): void;
    trackIntentFeasibleAndQueued(intentHash: string, jobId: string, model: IntentSourceModel): void;
    trackIntentInfeasible(intentHash: string, model: IntentSourceModel, error: any): void;
    trackIntentFulfillmentMethodSelected(intentHash: string, fulfillmentType: string, isNativeIntent: boolean, model: IntentSourceModel, solver?: any): void;
    trackQuoteRequestReceived(quoteIntentDataDTO: QuoteIntentDataDTO): void;
    trackQuoteResponseSuccess(quoteIntentDataDTO: QuoteIntentDataDTO, processingTime: number, quote: QuoteDataDTO): void;
    trackQuoteResponseError(quoteIntentDataDTO: QuoteIntentDataDTO, processingTime: number, error: any, statusCode?: number): void;
    trackQuoteProcessingStarted(quoteIntentDataDTO: QuoteIntentDataDTO, isReverseQuote: boolean): void;
    trackQuoteProcessingSuccess(quoteIntentDataDTO: QuoteIntentDataDTO, isReverseQuote: boolean, successfulQuotes: number, totalErrors: number, processingTime: number, executionTypes: string[]): void;
    trackQuoteStorageSuccess(quoteIntentDataDTO: QuoteIntentDataDTO, quoteIntents: any): void;
    trackReverseQuoteRequestReceived(quoteIntentDataDTO: QuoteIntentDataDTO): void;
    trackReverseQuoteResponseSuccess(quoteIntentDataDTO: QuoteIntentDataDTO, processingTime: number, quote: QuoteDataDTO): void;
    trackWatchCreateIntentSubscriptionStarted(sources: IntentSource[]): void;
    trackWatchCreateIntentSubscriptionSuccess(sources: IntentSource[]): void;
    trackWatchCreateIntentEventsDetected(eventCount: number, source: IntentSource): void;
    trackWatchCreateIntentJobQueued(createIntent: any, jobId: string, source: IntentSource): void;
    trackWatchIntentFundedEventsDetected(eventCount: number, source: IntentSource): void;
    trackWatchIntentFundedJobQueued(intent: any, jobId: string, source: IntentSource): void;
    trackWatchFulfillmentEventsDetected(eventCount: number, solver: any): void;
    trackWatchFulfillmentJobQueued(fulfillment: any, jobId: string, solver: any): void;
    trackWatchErrorOccurred(error: any, serviceName: string, context: any): void;
    trackWatchErrorRecoveryStarted(serviceName: string, context: any): void;
    trackWatchErrorRecoverySuccess(serviceName: string, context: any): void;
    trackWatchErrorRecoveryFailed(error: any, serviceName: string, context: any): void;
    /**
     * Track watch job queue failures with complete context objects
     */
    trackWatchJobQueueError(error: any, eventType: string, context: {
        intent?: any;
        createIntent?: any;
        fulfillment?: any;
        intentHash?: string;
        jobId: string;
        source?: IntentSource;
        solver?: any;
        transactionHash?: string;
        logIndex?: number;
    }): void;
    /**
     * Track gasless intent creation errors with complete context
     */
    trackGaslessIntentCreationError(error: any, quoteID: string, funder: string, route?: any, reward?: any): void;
    trackIntentFulfillmentStarted(intentHash: string): void;
    trackIntentFulfillmentSuccess(model: any, solver: any, receipt: any, processingTime: number): void;
    trackIntentFulfillmentFailed(model: any, solver: any, error: any, processingTime: number): void;
    trackIntentFulfillmentTransactionReverted(model: any, solver: any, receipt: any): void;
    trackIntentFeasibilityCheckStarted(intentHash: string): void;
    trackIntentFeasibilityCheckSuccess(intent: any): void;
    trackIntentFeasibilityCheckFailed(intent: any, error: any): void;
    trackErc20TransactionHandlingSuccess(transactionTargetData: any, solver: any, target: any, result: any): void;
    trackErc20TransactionHandlingUnsupported(transactionTargetData: any, solver: any, target: any): void;
    trackTransactionTargetGenerationSuccess(model: any, solver: any, functionFulfills: any): void;
    trackTransactionTargetGenerationError(model: any, solver: any, call: any): void;
    trackTransactionTargetUnsupportedContractType(model: any, solver: any, transactionTargetData: any): void;
    trackFulfillIntentTxCreationSuccess(model: any, inboxAddress: any, proverType: string, result: any): void;
    trackFulfillIntentTxCreationFailed(model: any, inboxAddress: any, error: any): void;
    trackIntentStatusUpdate(model: any, status: string, reason?: any): void;
    trackFulfillmentProcessingSuccess(fulfillment: any, model: any): void;
    trackFulfillmentProcessingIntentNotFound(fulfillment: any): void;
    trackFulfillmentProcessingError(fulfillment: any, error: any): void;
    trackIntentProcessDataRetrievalSuccess(intentHash: string, model: any, solver: any): void;
    trackIntentProcessDataRetrievalModelNotFound(intentHash: string, error: any): void;
    trackIntentProcessDataRetrievalSolverNotFound(intentHash: string, model: any): void;
    trackIntentProcessDataRetrievalError(intentHash: string, error: any): void;
    trackSolverResolutionSuccess(destination: any, solver: any, opts?: any): void;
    trackSolverResolutionNotFound(destination: any, opts?: any): void;
    trackCrowdLiquidityFulfillmentSuccess(model: any, solver: any, result: any, processingTime: number): void;
    trackCrowdLiquidityFulfillmentFailed(model: any, solver: any, error: any, processingTime: number): void;
    trackCrowdLiquidityFulfillmentRewardNotEnough(model: any, solver: any, error: any): void;
    trackCrowdLiquidityFulfillmentPoolNotSolvent(model: any, solver: any, error: any): void;
    trackCrowdLiquidityRebalanceSuccess(tokenIn: any, tokenOut: any, result: any): void;
    trackCrowdLiquidityRebalanceError(tokenIn: any, tokenOut: any, error: any): void;
    trackCrowdLiquidityRouteSupportCheck(intentModel: any): void;
    trackCrowdLiquidityRouteSupportResult(intentModel: any, isSupported: boolean, details: any): void;
    trackCrowdLiquidityRewardCheck(intentModel: any): void;
    trackCrowdLiquidityRewardCheckResult(intentModel: any, isEnough: boolean, details: any): void;
    trackCrowdLiquidityPoolSolvencyCheck(intentModel: any): void;
    trackCrowdLiquidityPoolSolvencyResult(intentModel: any, isSolvent: boolean, details: any): void;
    trackCrowdLiquidityPoolSolvencyError(intentModel: any, error: any): void;
    trackCrowdLiquidityLitActionSuccess(ipfsId: string, params: any, result: any): void;
    trackCrowdLiquidityLitActionError(ipfsId: string, params: any, error: any): void;
    trackIntentRetrievalSuccess(method: string, context: any): void;
    trackIntentRetrievalNotFound(method: string, context: any, error: any): void;
    trackIntentRetrievalError(method: string, error: any, context: any): void;
    trackQuoteFeasibilityCheckSuccess(quoteIntent: any): void;
    trackQuoteFeasibilityCheckError(quoteIntent: any, error: any): void;
    trackHealthRequestReceived(endpoint: string, requestData: any): void;
    trackHealthResponseSuccess(endpoint: string, responseData: any): void;
    trackHealthResponseError(endpoint: string, error: any, context: any): void;
    trackJobCompleted(jobName: string, jobContext: any): void;
    trackJobFailed(jobName: string, error: any, jobContext: any): void;
}
