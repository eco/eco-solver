import { EcoLogMessage } from '../eco-log-message'
import { EcoError } from '../../errors/eco-error'
import { LiquidityManagerLogContext, RejectionReason } from '../types'
import { BaseStructuredLogger } from './base-structured-logger'

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
}
