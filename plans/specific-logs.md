# Specific Business Logic Logging Integration Plan

## Executive Summary

This plan addresses the integration of **specific business logic logs** that were previously captured through manual `this.logger.*` calls and `ecoAnalytics` tracking into the new decorator-based structured logging paradigm. While the decorator infrastructure handles operation-level logging automatically, we need to ensure critical business events (like "duplicate intent found", "intent validation failed", "rebalancing skipped due to insufficient funds") are still captured with appropriate structured context.

## Problem Statement

During the decorator-based logging refactoring outlined in `special-logger.md`, we identified that:

1. **Critical Business Events are Lost**: The `@LogOperation` decorator handles method entry/exit/error logging, but doesn't capture specific business logic events that occur within method execution
2. **Analytics Integration Gaps**: Services use `ecoAnalytics.track*` methods for business intelligence that need structured logging equivalents
3. **Conditional Logic Logging**: Important conditional branches (duplicates, validation failures, retries) lose their specific context
4. **Debugging Information**: Important debug logs for troubleshooting complex business flows are missing

## Current Analysis

### Key Missing Business Logic Patterns

Based on analysis of services like `CreateIntentService`, `ValidateIntentService`, and `LiquidityManagerService`:

**1. Duplicate Detection & Early Returns**

```typescript
// CreateIntentService.createIntent() - Lines 67-75
if (model) {
  this.ecoAnalytics.trackIntentDuplicateDetected(intent, model, intentWs)
  return // Early return loses important business context
}
```

**2. Validation Failures & Specific Reasons**

```typescript
// ValidateIntentService.assertValidations() - Lines 148-161
this.ecoAnalytics.trackIntentValidationFailed(
  model.intent.hash,
  'validation_checks_failed',
  'assertValidations',
  {
    failedChecks: Object.entries(validations)
      .filter(([, passed]) => !passed)
      .map(([check]) => check),
  },
)
```

**3. Retry Logic & State Transitions**

```typescript
// ValidateIntentService.intentFunded() - Lines 235-241
this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FUNDING_CHECK_RETRY, {
  intentHash: model.intent.hash,
  retryCount,
  maxRetries: this.MAX_RETRIES,
})
```

**4. Business Status Updates & Lifecycle Events**

```typescript
// LiquidityManagerService - Lines 139-146
this.logger.log(
  { rebalanceId: 'system', walletAddress: kernelAddress, strategy: 'system' },
  'CHECK_BALANCES: scheduling cron (kernel wallet)',
  { intervalMs: this.config.intervalDuration },
)
```

## Solution: Enhanced Decorator Infrastructure

### Phase 1: Enhanced Logger Methods for Business Events

#### 1.1 Extend Specialized Loggers with Business Event Methods

**Add business-specific logging methods to each specialized logger:**

```typescript
// IntentOperationLogger enhancements
export class IntentOperationLogger extends BaseStructuredLogger {
  /**
   * Log duplicate intent detection with full context
   */
  logDuplicateIntentDetected(
    existingModel: IntentSourceModel,
    newIntent: IntentDataModel,
    eventContext?: any,
  ): void {
    const context = this.mergeContexts(
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
  logValidationFailure(
    intent: IntentDataModel,
    validationResults: IntentValidations,
    failedChecks: string[],
  ): void {
    const context = this.mergeContexts(extractIntentContext(intent), {
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
}
```

#### 1.2 LiquidityManagerLogger Business Event Methods

```typescript
// LiquidityManagerLogger enhancements
export class LiquidityManagerLogger extends BaseStructuredLogger {
  /**
   * Log rebalance analysis results
   */
  logRebalanceAnalysis(
    rebalance: RebalanceModel,
    analysisResults: {
      shouldExecute: boolean
      reason: string
      tokenStates: Record<string, TokenState>
      totalDifference: string
    },
  ): void {
    const context = this.mergeContexts(extractRebalanceContext(rebalance), {
      analysis: {
        should_execute: analysisResults.shouldExecute,
        analysis_reason: analysisResults.reason,
        total_difference: analysisResults.totalDifference,
        token_state_count: Object.keys(analysisResults.tokenStates).length,
      },
      operation: {
        business_event: 'rebalance_analysis_completed',
        action_taken: analysisResults.shouldExecute ? 'execute_rebalance' : 'skip_rebalance',
      },
    })

    const message = analysisResults.shouldExecute
      ? `Rebalance analysis: executing (${analysisResults.reason})`
      : `Rebalance analysis: skipping (${analysisResults.reason})`

    this.logMessage(context, 'info', message)
  }

  /**
   * Log quote strategy selection failures
   */
  logQuoteStrategyFailure(
    strategy: string,
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    error: Error,
  ): void {
    const context = {
      eco: {
        wallet_address: 'quote-generation',
        source_chain_id: tokenIn.config.chainId,
        destination_chain_id: tokenOut.config.chainId,
      },
      quote_strategy: {
        strategy_name: strategy,
        token_in_address: tokenIn.config.address,
        token_out_address: tokenOut.config.address,
        swap_amount: swapAmount.toString(),
        failure_reason: error.message,
      },
      operation: {
        business_event: 'quote_strategy_failed',
        action_taken: 'try_next_strategy',
      },
    }

    this.logMessage(context, 'warn', `Quote strategy ${strategy} failed: ${error.message}`)
  }

  /**
   * Log reservation analysis warnings
   */
  logReservationAnalysisWarning(walletAddress: string, tokenKey: string, warning: string): void {
    const context = {
      eco: {
        wallet_address: walletAddress,
      },
      reservation_analysis: {
        token_key: tokenKey,
        warning_type: warning,
        analysis_stage: 'token_adjustment',
      },
      operation: {
        business_event: 'reservation_analysis_warning',
        action_taken: 'skip_token_adjustment',
      },
    }

    this.logMessage(context, 'debug', `Reservation analysis: ${warning} for token ${tokenKey}`)
  }

  /**
   * Log insufficient balance scenarios
   */
  logInsufficientBalance(
    wallet: string,
    requiredAmount: string,
    availableAmount: string,
    tokenAddress: string,
    chainId: number,
  ): void {
    const context = {
      eco: {
        wallet_address: wallet,
        source_chain_id: chainId,
      },
      balance_check: {
        required_amount: requiredAmount,
        available_amount: availableAmount,
        token_address: tokenAddress,
        balance_deficit: 'insufficient_for_rebalance',
      },
      operation: {
        business_event: 'insufficient_balance_detected',
        action_taken: 'skip_rebalance',
      },
    }

    this.logMessage(
      context,
      'warn',
      `Insufficient balance: need ${requiredAmount}, have ${availableAmount}`,
    )
  }

  /**
   * Log scheduled job events
   */
  logScheduledJobEvent(
    walletAddress: string,
    jobType: string,
    action: 'scheduled' | 'executed' | 'failed',
    details?: Record<string, any>,
  ): void {
    const context = {
      eco: {
        wallet_address: walletAddress,
      },
      scheduling: {
        job_type: jobType,
        job_action: action,
        ...details,
      },
      operation: {
        business_event: 'scheduled_job_lifecycle',
        action_taken: `job_${action}`,
      },
    }

    this.logMessage(
      context,
      action === 'failed' ? 'error' : 'info',
      `Scheduled job ${action}: ${jobType}`,
    )
  }
}
```

#### 1.3 QuoteGenerationLogger Business Event Methods

```typescript
// QuoteGenerationLogger enhancements
export class QuoteGenerationLogger extends BaseStructuredLogger {
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
}
```

#### 1.4 TransactionLogger Business Event Methods

```typescript
// TransactionLogger enhancements
export class TransactionLogger extends BaseStructuredLogger {
  /**
   * Log gas estimation failures
   */
  logGasEstimationFailure(chainId: number, transactionCount: number, error: Error): void {
    const context = {
      eco: {
        source_chain_id: chainId,
      },
      gas_estimation: {
        transaction_count: transactionCount,
        estimation_stage: 'kernel_execution',
        failure_reason: error.message,
      },
      operation: {
        business_event: 'gas_estimation_failed',
        action_taken: 'return_estimation_error',
      },
    }

    this.logMessage(
      context,
      'error',
      `Gas estimation failed for ${transactionCount} transactions: ${error.message}`,
    )
  }

  /**
   * Log gas price fetch fallback
   */
  logGasPriceFallback(chainId: number, defaultValue: bigint, error: Error): void {
    const context = {
      eco: {
        source_chain_id: chainId,
      },
      gas_pricing: {
        fallback_value: defaultValue.toString(),
        fetch_error: error.message,
        pricing_stage: 'gas_price_fetch',
      },
      operation: {
        business_event: 'gas_price_fallback',
        action_taken: 'use_default_gas_price',
      },
    }

    this.logMessage(
      context,
      'warn',
      `Gas price fetch failed, using fallback: ${defaultValue.toString()}`,
    )
  }

  /**
   * Log permit validation failures
   */
  logPermitValidationFailure(
    intentHash: string,
    validationType: 'permit_simulation' | 'vault_funding',
    error: Error,
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      permit_validation: {
        validation_type: validationType,
        validation_stage: 'permit_processing',
        failure_reason: error.message,
      },
      operation: {
        business_event: 'permit_validation_failed',
        action_taken: 'return_validation_error',
      },
    }

    this.logMessage(
      context,
      'error',
      `Permit validation failed (${validationType}): ${error.message}`,
    )
  }

  /**
   * Log successful permit validation
   */
  logPermitValidationSuccess(
    intentHash: string,
    validationType: 'vault_funding' | 'permit_batch',
  ): void {
    const context = {
      eco: {
        intent_hash: intentHash,
      },
      permit_validation: {
        validation_type: validationType,
        validation_stage: 'permit_processing',
        validation_result: 'success',
      },
      operation: {
        business_event: 'permit_validation_success',
        action_taken: 'proceed_with_intent',
      },
    }

    this.logMessage(context, 'debug', `Permit validation successful: ${validationType}`)
  }
}
```

### Phase 2: Service Integration Patterns

#### 2.1 Enhanced Method Decoration with Business Events

**Pattern: Combine `@LogOperation` with inline business event logging**

```typescript
// CreateIntentService - Enhanced pattern
export class CreateIntentService implements OnModuleInit {
  private logger = new IntentOperationLogger('CreateIntentService')

  @LogOperation('intent_creation', IntentOperationLogger)
  async createIntent(@LogContext serializedIntentWs: Serialize<IntentCreatedLog>) {
    const intentWs = deserialize(serializedIntentWs)
    const ei = decodeCreateIntentLog(intentWs.data, intentWs.topics)
    const intent = IntentDataModel.fromEvent(ei, intentWs.logIndex || 0)

    try {
      // Check for existing intent
      const model = await this.intentModel.findOne({ 'intent.hash': intent.hash })

      if (model) {
        // Business event: duplicate detected
        this.logger.logDuplicateIntentDetected(model, intent, intentWs)
        return // Early return but business context captured
      }

      const validWallet = this.flagService.getFlagValue('bendWalletOnly')
        ? await this.validSmartWalletService.validateSmartWallet(
            intent.reward.creator as Hex,
            intentWs.sourceChainID,
          )
        : true

      // Create db record
      const record = await this.intentModel.create({
        event: intentWs,
        intent: intent,
        receipt: null,
        status: validWallet ? 'PENDING' : 'NON-BEND-WALLET',
      })

      const jobId = getIntentJobId('create', intent.hash as Hex, intent.logIndex)

      if (validWallet) {
        await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.validate_intent, intent.hash, {
          jobId,
          ...this.intentJobConfig,
        })

        // Business event: intent created and queued
        this.logger.logIntentStatusTransition(intent.hash, 'NEW', 'PENDING', 'valid_bend_wallet')
      } else {
        // Business event: wallet validation failed
        this.logger.logIntentStatusTransition(
          intent.hash,
          'NEW',
          'NON-BEND-WALLET',
          'invalid_bend_wallet',
        )
      }
    } catch (e) {
      // Error already captured by @LogOperation decorator
      // Additional business context can be added here if needed
      throw e
    }
  }
}
```

#### 2.2 Validation Service Pattern

```typescript
// ValidateIntentService - Enhanced pattern
export class ValidateIntentService implements OnModuleInit {
  private logger = new IntentOperationLogger('ValidateIntentService')

  @LogOperation('intent_validation', IntentOperationLogger)
  async validateIntent(@LogContext intentHash: Hex) {
    const { model, solver } = await this.destructureIntent(intentHash)
    if (!model || !solver) {
      return false
    }

    if (!(await this.assertValidations(model, solver))) {
      return false
    }

    const jobId = getIntentJobId('validate', intentHash, model.intent.logIndex)
    await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.feasable_intent, intentHash, {
      jobId,
      ...this.intentJobConfig,
    })

    // Business event: successful validation
    this.logger.logIntentStatusTransition(
      intentHash,
      'PENDING',
      'VALIDATED',
      'all_validation_checks_passed',
    )

    return true
  }

  @LogSubOperation('validation_checks')
  async assertValidations(model: IntentSourceModel, solver: Solver): Promise<boolean> {
    const validations = (await this.validationService.assertValidations(
      model.intent,
      solver,
    )) as IntentValidations

    validations.intentFunded = await this.checkFunding(model)

    if (validationsFailed(validations)) {
      const failedChecks = Object.entries(validations)
        .filter(([, passed]) => !passed)
        .map(([check]) => check)

      // Business event: validation failure with detailed reasons
      this.logger.logValidationFailure(model.intent, validations, failedChecks)

      await this.utilsIntentService.updateInvalidIntentModel(model, validations)
      return false
    }

    return true
  }

  @LogSubOperation('funding_verification')
  async checkFunding(model: IntentSourceModel): Promise<boolean> {
    let retryCount = 0
    let isIntentFunded = false

    do {
      if (retryCount > 0) {
        // Business event: retry attempt
        this.logger.logFundingCheckRetry(
          model.intent.hash,
          retryCount,
          this.MAX_RETRIES,
          Number(model.intent.route.source),
        )

        await delay(this.RETRY_DELAY_MS, retryCount - 1)
      }

      isIntentFunded = await this.performFundingCheck(model)
      retryCount++
    } while (!isIntentFunded && retryCount <= this.MAX_RETRIES)

    return isIntentFunded
  }
}
```

### Phase 3: Legacy Logger and Console Elimination Strategy

#### 3.1 Console.\* Replacement

**Replace all console calls with appropriate business event logging:**

```typescript
// BEFORE: Direct console usage
console.log('Starting operation...')
console.error('Operation failed:', error)
console.debug('Retry attempt:', retryCount)

// AFTER: Structured business event logging
class ServiceClass {
  private logger = new OperationLogger('ServiceClass')

  async someMethod() {
    // Operational logging
    this.logger.logMessage(
      { operation: { business_event: 'operation_started' } },
      'info',
      'Starting operation',
    )

    try {
      // Operation logic
    } catch (error) {
      // Error already handled by @LogOperation, additional business context:
      this.logger.logMessage(
        {
          operation: { business_event: 'operation_failed', error_type: error.constructor.name },
          error: { message: error.message, stack: error.stack },
        },
        'error',
        'Operation failed',
      )
      throw error
    }
  }
}
```

#### 3.2 Legacy Logger Cleanup

**Remove manual context creation and logger instances:**

```typescript
// BEFORE: Manual logging with EcoLogger
class ServiceClass {
  private logger = new EcoLogger('ServiceClass')

  async method() {
    const context = {
      intentHash: intent.hash,
      quoteId: intent.quoteID,
      // ... 15+ manual mappings
    }
    this.logger.log(context, 'Started')
    try {
      /* operation */
    } catch {
      /* manual error logging */
    }
  }
}

// AFTER: Decorator + business events
class ServiceClass {
  private logger = new IntentOperationLogger('ServiceClass')

  @LogOperation('method_execution', IntentOperationLogger)
  async method(@LogContext intent: IntentDataModel) {
    // Automatic context extraction via decorator

    // Only explicit business events needed:
    if (someCondition) {
      this.logger.logBusinessEvent(intent, 'conditional_path_taken', {
        reason: 'specific_condition',
      })
    }

    return await this.performOperation(intent)
  }
}
```

#### 2.3 Additional Service Integration Patterns

**Critical Business Logic Found in Git Diff Analysis:**

```typescript
// LiquidityProviderService - Enhanced pattern with strategy failure tracking
export class LiquidityProviderService {
  private logger = new LiquidityManagerLogger('LiquidityProviderService')

  @LogOperation('quote_generation', LiquidityManagerLogger, {
    sampling: { rate: 0.1, level: 'debug' },
  })
  async getQuote(
    @LogContext walletAddress: string,
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
  ): Promise<RebalanceQuote[]> {
    const strategies = this.getWalletSupportedStrategies(walletAddress)

    // Process quotes with business event logging for failures
    const quoteBatchRequests = strategies.map(async (strategy) => {
      try {
        const service = this.getStrategyService(strategy)
        return await service.getQuote(tokenIn, tokenOut, swapAmount, quoteId)
      } catch (error) {
        // Business event: strategy failure
        this.logger.logQuoteStrategyFailure(strategy, tokenIn, tokenOut, swapAmount, error)
        return null
      }
    })

    // Continue with best quote selection logic...
  }
}

// WalletFulfillService - Enhanced with feasibility check logging
export class WalletFulfillService implements IFulfillService {
  private logger = new IntentOperationLogger('WalletFulfillService')

  @LogSubOperation('feasibility_check')
  async finalFeasibilityCheck(@LogContext intent: IntentDataModel) {
    const { error } = await this.feeService.isRouteFeasible(intent)
    if (error) {
      // Business event: feasibility failure
      this.logger.logValidationFailure(intent, { feasibilityCheck: false }, ['route_not_feasible'])
      throw error
    }
  }
}

// IntentInitiationService - Enhanced with gasless intent support tracking
export class IntentInitiationService implements OnModuleInit {
  private logger = new IntentOperationLogger('IntentInitiationService')

  private checkGaslessIntentSupported(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): EcoResponse<void> {
    const { dAppID } = gaslessIntentRequestDTO

    if (!this.gaslessIntentdAppIDs.includes(dAppID)) {
      // Business event: unsupported dApp
      this.logger.logMessage(
        {
          eco: { d_app_id: dAppID },
          gasless_check: {
            supported: false,
            reason: 'dapp_not_in_allowlist',
            supported_dapps: this.gaslessIntentdAppIDs.length,
          },
          operation: {
            business_event: 'gasless_intent_support_check',
            action_taken: 'reject_gasless_request',
          },
        },
        'warn',
        `Gasless intent not supported for dAppID: ${dAppID}`,
      )

      return { error: EcoError.GaslessIntentsNotSupported }
    }

    return {}
  }
}

// KernelAccountClientService - Enhanced with deployment and gas estimation tracking
export class KernelAccountClientService {
  protected logger = new TransactionLogger('KernelAccountClientService')

  async estimateGasForKernelExecution(
    chainID: number,
    transactions: ExecuteSmartWalletArg[],
  ): Promise<EcoResponse<EstimatedGasData>> {
    try {
      const clientKernel = await this.getClient(chainID)
      // Gas estimation logic...
      return { response: estimatedGasData }
    } catch (ex) {
      // Business event: gas estimation failure
      this.logger.logGasEstimationFailure(chainID, transactions.length, ex)
      return { error: EcoError.GasEstimationError }
    }
  }

  async getGasPrice(chainID: number, defaultValue: bigint): Promise<bigint> {
    try {
      const client = await this.kernelAccountClientService.getClient(chainID)
      return await client.getGasPrice()
    } catch (ex) {
      // Business event: gas price fallback
      this.logger.logGasPriceFallback(chainID, defaultValue, ex)
      return defaultValue
    }
  }
}
```

### Phase 4: Implementation Guidelines

#### 4.1 Service-by-Service Migration

**Priority Order (Updated based on git diff analysis):**

1. **CreateIntentService** - Critical duplicate detection and wallet validation
2. **ValidateIntentService** - Complex validation and retry logic
3. **FulfillIntentService** - Multi-path fulfillment with method selection
4. **WalletFulfillService** - Feasibility checks and transaction generation
5. **LiquidityManagerService** - Complex rebalancing analysis and scheduling
6. **LiquidityProviderService** - Strategy selection and failure handling
7. **QuoteService** - Quote generation method selection and feasibility
8. **IntentInitiationService** - Gasless intent flows and gas estimation
9. **PermitValidationService** - Permit simulation and vault funding validation
10. **KernelAccountClientService** - Gas estimation and smart wallet operations

#### 4.2 Business Event Identification Pattern

**For each service method:**

1. **Identify Critical Decisions**: Points where business logic branches significantly
2. **Capture State Transitions**: Status changes, lifecycle events
3. **Track Resource Issues**: Insufficient balances, missing data, validation failures
4. **Log Retry Logic**: Retry attempts, backoff strategies, eventual failures
5. **Document Early Returns**: Why processing stopped, what conditions caused exits

#### 4.3 Testing Strategy for Business Events

```typescript
// Test business event logging alongside decorator functionality
describe('CreateIntentService', () => {
  let service: CreateIntentService
  let mockLogger: jest.Mocked<IntentOperationLogger>

  beforeEach(() => {
    mockLogger = createMockIntentLogger()
  })

  it('should log duplicate intent detection', async () => {
    const existingModel = createMockIntentModel()
    jest.spyOn(service['intentModel'], 'findOne').mockResolvedValue(existingModel)

    await service.createIntent(mockIntentWs)

    // Test decorator operation logging
    expect(mockLogger.logMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'intent_creation started',
      }),
      'info',
    )

    // Test business event logging
    expect(mockLogger.logDuplicateIntentDetected).toHaveBeenCalledWith(
      existingModel,
      expect.any(Object),
      mockIntentWs,
    )
  })
})
```

## Migration Timeline and Success Criteria

### Week 1: Core Infrastructure Enhancement

- [ ] Extend IntentOperationLogger with business event methods
- [ ] Extend LiquidityManagerLogger with rebalancing events
- [ ] Extend QuoteGenerationLogger with quote lifecycle events
- [ ] Extend TransactionLogger with gas estimation and execution tracking
- [ ] Update context extractors to support business event contexts

### Week 2: Service Integration

- [ ] Migrate CreateIntentService with duplicate detection logging
- [ ] Migrate ValidateIntentService with validation failure tracking
- [ ] Migrate FulfillIntentService with fulfillment method selection logging
- [ ] Migrate WalletFulfillService with feasibility check logging
- [ ] Migrate QuoteService with quote generation and rejection tracking
- [ ] Migrate LiquidityProviderService with strategy selection and failure tracking
- [ ] Migrate IntentInitiationService with gasless intent flow tracking
- [ ] Migrate PermitValidationService with validation failure logging
- [ ] Migrate KernelAccountClientService with gas estimation and deployment tracking
- [ ] Update all services to use business event methods

### Week 3: Legacy Cleanup & Console Elimination

- [ ] Replace all `console.*` calls with structured logging
- [ ] Remove unused `EcoLogger` instances
- [ ] Clean up manual context creation code
- [ ] Update CLI and script logging

### Week 4: Testing & Validation

- [ ] Update test suites for business event logging
- [ ] Validate no critical business events are lost
- [ ] Ensure analytics data still flows correctly
- [ ] Performance testing with enhanced logging

### Success Criteria

**Business Logic Coverage:**

- [ ] All duplicate detection scenarios logged with structured context (CreateIntentService)
- [ ] All validation failures captured with specific failure reasons (ValidateIntentService)
- [ ] All retry attempts tracked with attempt counts and reasons (ValidateIntentService)
- [ ] All status transitions logged with from/to states and triggers (All intent services)
- [ ] All early returns documented with business reasons (All services)
- [ ] All strategy selection failures tracked (LiquidityProviderService)
- [ ] All feasibility check results logged (WalletFulfillService, QuoteService)
- [ ] All gas estimation failures and fallbacks tracked (KernelAccountClientService)
- [ ] All permit validation results captured (PermitValidationService)
- [ ] All gasless intent support checks logged (IntentInitiationService)
- [ ] All quota and reservation analysis warnings captured (LiquidityManagerService)
- [ ] All crowd liquidity fallback scenarios logged (FulfillIntentService)

**Analytics Continuity:**

- [ ] All critical business intelligence data still captured
- [ ] Failure analysis remains comprehensive
- [ ] Performance metrics continue to be tracked
- [ ] Operational dashboards remain functional

**Code Quality:**

- [ ] Zero `console.*` calls in production code
- [ ] All services use enhanced specialized loggers
- [ ] Manual context creation eliminated where decorators are used
- [ ] Business event logging is consistent across services

## Benefits of Enhanced Approach

### 1. Complete Business Context Coverage

- **No Lost Events**: Critical business logic preserved with structured context
- **Enhanced Debugging**: Rich context makes troubleshooting significantly faster
- **Operational Intelligence**: Business events enable better monitoring and alerting

### 2. Analytics Integration

- **Structured Business Intelligence**: All analytics data captured in structured format
- **Query Optimization**: Business events optimized for Datadog analytics
- **Dashboard Compatibility**: Existing dashboards continue working with enhanced data

### 3. Development Experience

- **Consistent Patterns**: Standardized business event logging across services
- **Type Safety**: Business event methods provide type safety and intellisense
- **Maintainable**: Business logic changes automatically reflected in logging

### 4. Production Readiness

- **Cost Optimized**: Business events include same sampling and size controls
- **Performance**: Minimal overhead with structured approach
- **Compliance**: All Datadog limits and best practices maintained

## Conclusion

This enhanced logging approach ensures that the transition to decorator-based structured logging **preserves all critical business intelligence** while providing the benefits of automatic context extraction and operation tracking. The specialized logger business event methods bridge the gap between automated operation logging and specific business logic tracking, resulting in comprehensive observability without the maintenance overhead of manual logging approaches.

The key innovation is **combining automatic decorator logging with explicit business event logging**, ensuring that both operational context (method execution, timing, errors) and business context (duplicates, validations, state transitions) are captured in a consistent, structured format.
