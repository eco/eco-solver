import { EcoLogMessage } from '../eco-log-message'
import { EcoError } from '../../errors/eco-error'
import { LiquidityManagerLogContext, RejectionReason } from '../types'
import { BaseStructuredLogger } from './base-structured-logger'
import { extractRebalanceContext, mergeContexts } from '../decorators/context-extractors'

/**
 * Specialized logger for liquidity management operations
 */
export class LiquidityManagerLogger extends BaseStructuredLogger {
  constructor(context: string = 'LiquidityManager') {
    super(context)
  }

  /**
   * Log a liquidity operation message with structured context
   */
  log(context: LiquidityManagerLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.forLiquidityOperation({
      message,
      rebalanceId: context.rebalanceId,
      walletAddress: context.walletAddress,
      strategy: context.strategy,
      sourceChainId: context.sourceChainId,
      destinationChainId: context.destinationChainId,
      tokenInAddress: context.tokenInAddress,
      tokenOutAddress: context.tokenOutAddress,
      groupId: context.groupId,
      operationType: 'rebalancing',
      status: 'completed',
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log a liquidity operation error with structured context
   */
  error(
    context: LiquidityManagerLogContext,
    message: string,
    error?: Error,
    properties?: object,
  ): void {
    if (error && error instanceof EcoError) {
      const structure = EcoLogMessage.withEnhancedError(message, error, 'error', {
        eco: {
          rebalance_id: context.rebalanceId,
          wallet_address: context.walletAddress,
          strategy: context.strategy,
          source_chain_id: context.sourceChainId,
          destination_chain_id: context.destinationChainId,
          group_id: context.groupId,
        },
        ...properties,
      })
      this.logStructured(structure, 'error')
    } else {
      // Fallback for non-EcoError instances
      const structure = EcoLogMessage.forLiquidityOperation({
        message,
        rebalanceId: context.rebalanceId,
        walletAddress: context.walletAddress,
        strategy: context.strategy,
        sourceChainId: context.sourceChainId,
        destinationChainId: context.destinationChainId,
        operationType: 'rebalancing',
        status: 'failed',
        properties: { error: error?.toString(), ...properties },
      })
      this.logStructured(structure, 'error')
    }
  }

  /**
   * Log a liquidity operation warning with structured context
   */
  warn(context: LiquidityManagerLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.withBusinessContext(
      message,
      {
        rebalance_id: context.rebalanceId,
        wallet_address: context.walletAddress,
        strategy: context.strategy,
        source_chain_id: context.sourceChainId,
        destination_chain_id: context.destinationChainId,
        group_id: context.groupId,
      },
      'warn',
      properties,
    )
    this.logStructured(structure, 'warn')
  }

  /**
   * Log a liquidity operation debug message with structured context
   */
  debug(context: LiquidityManagerLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.withBusinessContext(
      message,
      {
        rebalance_id: context.rebalanceId,
        wallet_address: context.walletAddress,
        strategy: context.strategy,
        source_chain_id: context.sourceChainId,
        destination_chain_id: context.destinationChainId,
        group_id: context.groupId,
      },
      'debug',
      properties,
    )
    this.logStructured(structure, 'debug')
  }

  /**
   * Log a successful rebalancing operation
   */
  logRebalanceSuccess(
    context: LiquidityManagerLogContext,
    amountIn: string,
    amountOut: string,
    properties?: object,
  ): void {
    const structure = EcoLogMessage.forLiquidityOperation({
      message: 'Rebalancing operation completed successfully',
      rebalanceId: context.rebalanceId,
      walletAddress: context.walletAddress,
      strategy: context.strategy,
      sourceChainId: context.sourceChainId,
      destinationChainId: context.destinationChainId,
      tokenInAddress: context.tokenInAddress,
      tokenOutAddress: context.tokenOutAddress,
      amountIn,
      amountOut,
      groupId: context.groupId,
      operationType: 'rebalancing',
      status: 'completed',
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log a quote rejection
   */
  logQuoteRejection(
    context: LiquidityManagerLogContext,
    rejectionReason: RejectionReason,
    properties?: object,
  ): void {
    const structure = EcoLogMessage.forLiquidityOperation({
      message: `Quote rejected: ${rejectionReason}`,
      rebalanceId: context.rebalanceId,
      walletAddress: context.walletAddress,
      strategy: context.strategy,
      sourceChainId: context.sourceChainId,
      destinationChainId: context.destinationChainId,
      groupId: context.groupId,
      operationType: 'quote_rejection',
      status: 'rejected',
      rejectionReason,
      properties,
    })
    this.logStructured(structure, 'warn')
  }

  // ================== BUSINESS EVENT METHODS ==================

  /**
   * Log rebalance analysis results
   */
  logRebalanceAnalysis(
    rebalance: any,
    analysisResults: {
      shouldExecute: boolean
      reason: string
      tokenStates?: Record<string, any>
      totalDifference?: string
    },
  ): void {
    const context = mergeContexts(extractRebalanceContext(rebalance), {
      analysis: {
        should_execute: analysisResults.shouldExecute,
        analysis_reason: analysisResults.reason,
        total_difference: analysisResults.totalDifference,
        token_state_count: analysisResults.tokenStates
          ? Object.keys(analysisResults.tokenStates).length
          : 0,
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
    tokenIn: any,
    tokenOut: any,
    swapAmount: number,
    error: Error,
  ): void {
    const context = {
      eco: {
        wallet_address: 'quote-generation',
        source_chain_id: tokenIn?.config?.chainId || tokenIn?.chainId,
        destination_chain_id: tokenOut?.config?.chainId || tokenOut?.chainId,
      },
      quote_strategy: {
        strategy_name: strategy,
        token_in_address: tokenIn?.config?.address || tokenIn?.address,
        token_out_address: tokenOut?.config?.address || tokenOut?.address,
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

  /**
   * Log quote batch processing results
   */
  logQuoteBatchResults(
    walletAddress: string,
    tokenIn: any,
    tokenOut: any,
    totalStrategies: number,
    successfulQuotes: number,
    hadQuotesButRejected: boolean,
  ): void {
    const context = {
      eco: {
        wallet_address: walletAddress,
        source_chain_id: tokenIn?.config?.chainId,
        destination_chain_id: tokenOut?.config?.chainId,
      },
      quote_batch: {
        total_strategies: totalStrategies,
        successful_quotes: successfulQuotes,
        had_quotes_but_rejected: hadQuotesButRejected,
        success_rate:
          totalStrategies > 0 ? (successfulQuotes / totalStrategies).toFixed(2) : '0.00',
      },
      operation: {
        business_event: 'quote_batch_completed',
        action_taken: successfulQuotes > 0 ? 'return_best_quotes' : 'return_no_quotes',
      },
    }

    const message =
      successfulQuotes > 0
        ? `Quote batch: ${successfulQuotes}/${totalStrategies} strategies successful`
        : `Quote batch: no successful quotes from ${totalStrategies} strategies`

    this.logMessage(context, successfulQuotes > 0 ? 'info' : 'warn', message)
  }

  /**
   * Log fallback quote generation attempts
   */
  logFallbackQuoteGeneration(
    tokenIn: any,
    tokenOut: any,
    swapAmount: number,
    success: boolean,
    quoteId?: string,
  ): void {
    const context = {
      eco: {
        quote_id: quoteId || 'fallback-quote',
        source_chain_id: tokenIn?.config?.chainId,
        destination_chain_id: tokenOut?.config?.chainId,
      },
      fallback_quote: {
        token_in_address: tokenIn?.config?.address,
        token_out_address: tokenOut?.config?.address,
        swap_amount: swapAmount.toString(),
        fallback_success: success,
        fallback_method: 'core_token_routing',
      },
      operation: {
        business_event: 'fallback_quote_generation',
        action_taken: success ? 'return_fallback_quote' : 'fallback_failed',
      },
    }

    const message = success
      ? `Fallback quote generation successful via core token routing`
      : `Fallback quote generation failed for route`

    this.logMessage(context, success ? 'info' : 'error', message)
  }
}
