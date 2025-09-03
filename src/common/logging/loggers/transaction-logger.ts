import { EcoLogMessage } from '../eco-log-message'
import { EcoError } from '../../errors/eco-error'
import { TransactionOperationLogContext } from '../types'
import { BaseStructuredLogger } from './base-structured-logger'

/**
 * Specialized logger for transaction and signing operations
 * Handles blockchain transactions, smart wallet operations, and signature generation
 */
export class TransactionLogger extends BaseStructuredLogger {
  constructor(context: string = 'Transaction') {
    super(context)
  }

  /**
   * Log a transaction operation message with structured context
   */
  log(context: TransactionOperationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.forTransactionOperation({
      message,
      transactionHash: context.transactionHash,
      walletAddress: context.walletAddress,
      chainId: context.chainId,
      operationType: context.operationType || 'transaction_send',
      status: context.status || 'pending',
      blockNumber: context.blockNumber,
      nonce: context.nonce,
      value: context.value,
      to: context.to,
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log a transaction operation error with structured context
   */
  error(
    context: TransactionOperationLogContext,
    message: string,
    error?: Error,
    properties?: object,
  ): void {
    if (error && error instanceof EcoError) {
      const structure = EcoLogMessage.withEnhancedError(message, error, 'error', {
        eco: {
          transaction_hash: context.transactionHash,
          wallet_address: context.walletAddress,
          source_chain_id: context.chainId,
        },
        metrics: {
          gas_used: context.nonce,
          block_number: context.blockNumber,
          nonce: context.nonce,
          transaction_value: context.value,
        },
        ...properties,
      })
      this.logStructured(structure, 'error')
    } else {
      // Fallback for non-EcoError instances
      const structure = EcoLogMessage.forTransactionOperation({
        message,
        transactionHash: context.transactionHash,
        walletAddress: context.walletAddress,
        chainId: context.chainId,
        operationType: context.operationType || 'transaction_send',
        status: 'failed',
        blockNumber: context.blockNumber,
        nonce: context.nonce,
        value: context.value,
        to: context.to,
        properties: { error: error?.toString(), ...properties },
      })
      this.logStructured(structure, 'error')
    }
  }

  /**
   * Log a transaction operation warning with structured context
   */
  warn(context: TransactionOperationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.withBusinessContext(
      message,
      {
        transaction_hash: context.transactionHash,
        wallet_address: context.walletAddress,
        source_chain_id: context.chainId,
      },
      'warn',
      properties,
    )
    this.logStructured(structure, 'warn')
  }

  /**
   * Log a transaction operation debug message with structured context
   */
  debug(context: TransactionOperationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.withBusinessContext(
      message,
      {
        transaction_hash: context.transactionHash,
        wallet_address: context.walletAddress,
        source_chain_id: context.chainId,
      },
      'debug',
      properties,
    )
    this.logStructured(structure, 'debug')
  }

  /**
   * Log a successful transaction confirmation
   */
  logTransactionSuccess(
    context: TransactionOperationLogContext,
    gasUsed?: number,
    gasPrice?: string,
    properties?: object,
  ): void {
    const structure = EcoLogMessage.forTransactionOperation({
      message: 'Transaction confirmed successfully',
      transactionHash: context.transactionHash!,
      walletAddress: context.walletAddress,
      chainId: context.chainId,
      gasUsed,
      gasPrice,
      operationType: 'transaction_confirm',
      status: 'completed',
      blockNumber: context.blockNumber,
      nonce: context.nonce,
      value: context.value,
      to: context.to,
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log a signature generation operation
   */
  logSignatureGeneration(
    walletAddress: string,
    operationType: 'signature_generation' | 'wallet_operation' = 'signature_generation',
    properties?: object,
  ): void {
    const structure = EcoLogMessage.forTransactionOperation({
      message: 'Signature generated successfully',
      walletAddress,
      operationType,
      status: 'signed',
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log a smart wallet deployment
   */
  logSmartWalletDeployment(context: TransactionOperationLogContext, properties?: object): void {
    const structure = EcoLogMessage.forTransactionOperation({
      message: 'Smart wallet deployed successfully',
      transactionHash: context.transactionHash,
      walletAddress: context.walletAddress!,
      chainId: context.chainId,
      operationType: 'smart_wallet_deploy',
      status: context.status || 'completed',
      blockNumber: context.blockNumber,
      nonce: context.nonce,
      value: context.value,
      to: context.to,
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log transaction pending status
   */
  logTransactionPending(
    transactionHash: string,
    walletAddress: string,
    chainId: number,
    properties?: object,
  ): void {
    const structure = EcoLogMessage.forTransactionOperation({
      message: 'Transaction submitted to mempool',
      transactionHash,
      walletAddress,
      chainId,
      operationType: 'transaction_send',
      status: 'pending',
      properties,
    })
    this.logStructured(structure, 'info')
  }
}
