import { EcoLogMessage } from '../eco-log-message'
import { EcoError } from '../../errors/eco-error'
import { TransactionOperationLogContext } from '../types'
import { BaseStructuredLogger } from './base-structured-logger'
import '../decorators/context-extractors'

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

  // ================== BUSINESS EVENT METHODS ==================

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

  /**
   * Log smart wallet deployment events
   */
  logSmartWalletDeploymentEvent(
    walletAddress: string,
    chainId: number,
    deploymentStage: 'initiated' | 'completed' | 'failed',
    deploymentReceipt?: string,
    error?: Error,
  ): void {
    const context = {
      eco: {
        wallet_address: walletAddress,
        source_chain_id: chainId,
      },
      smart_wallet_deployment: {
        deployment_stage: deploymentStage,
        deployment_receipt: deploymentReceipt,
        failure_reason: error?.message,
      },
      operation: {
        business_event: 'smart_wallet_deployment_event',
        action_taken:
          deploymentStage === 'completed'
            ? 'wallet_deployed'
            : deploymentStage === 'failed'
              ? 'deployment_failed'
              : 'deployment_initiated',
      },
    }

    const message =
      deploymentStage === 'completed'
        ? `Smart wallet deployment completed: ${walletAddress}`
        : deploymentStage === 'failed'
          ? `Smart wallet deployment failed: ${error?.message}`
          : `Smart wallet deployment initiated: ${walletAddress}`

    this.logMessage(context, deploymentStage === 'failed' ? 'error' : 'info', message)
  }

  /**
   * Log gas estimation success with detailed metrics
   */
  logGasEstimationSuccess(
    chainId: number,
    transactionCount: number,
    gasEstimate: bigint,
    gasPrice: bigint,
    totalCost: bigint,
  ): void {
    const context = {
      eco: {
        source_chain_id: chainId,
      },
      gas_estimation: {
        transaction_count: transactionCount,
        estimation_stage: 'kernel_execution',
        gas_estimate: gasEstimate.toString(),
        gas_price: gasPrice.toString(),
        total_cost: totalCost.toString(),
      },
      operation: {
        business_event: 'gas_estimation_success',
        action_taken: 'return_estimation_data',
      },
      metrics: {
        gas_used: gasEstimate.toString(),
        gas_price: gasPrice.toString(),
        transaction_value: totalCost.toString(),
      },
    }

    this.logMessage(
      context,
      'debug',
      `Gas estimation successful: ${gasEstimate.toString()} units at ${gasPrice.toString()} wei`,
    )
  }

  /**
   * Log transaction batch execution results
   */
  logTransactionBatchExecution(
    walletAddress: string,
    chainId: number,
    batchSize: number,
    success: boolean,
    transactionHash?: string,
    error?: Error,
  ): void {
    const context = {
      eco: {
        wallet_address: walletAddress,
        source_chain_id: chainId,
        transaction_hash: transactionHash,
      },
      transaction_batch: {
        batch_size: batchSize,
        batch_success: success,
        failure_reason: error?.message,
      },
      operation: {
        business_event: 'transaction_batch_executed',
        action_taken: success ? 'batch_executed' : 'batch_failed',
      },
    }

    const message = success
      ? `Transaction batch executed successfully: ${batchSize} transactions`
      : `Transaction batch execution failed: ${error?.message}`

    this.logMessage(context, success ? 'info' : 'error', message)
  }

  /**
   * Log signature generation events
   */
  logSignatureGenerationEvent(
    walletAddress: string,
    operationType: 'signature_generation' | 'transaction_signing',
    success: boolean,
    signatureData?: any,
    error?: Error,
  ): void {
    const context = {
      eco: {
        wallet_address: walletAddress,
      },
      signature_generation: {
        operation_type: operationType,
        signature_success: success,
        signature_algorithm: signatureData?.algorithm || 'ECDSA',
        signature_curve: signatureData?.curve || 'secp256k1',
        failure_reason: error?.message,
      },
      operation: {
        business_event: 'signature_generation_event',
        action_taken: success ? 'signature_generated' : 'signature_failed',
      },
    }

    const message = success
      ? `Signature generated successfully for ${operationType}`
      : `Signature generation failed for ${operationType}: ${error?.message}`

    this.logMessage(context, success ? 'debug' : 'error', message)
  }
}
