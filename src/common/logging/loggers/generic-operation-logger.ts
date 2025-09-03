import { BaseStructuredLogger } from './base-structured-logger'
import { GenericOperationLogContext, GenericOperationLogParams } from '../types'
import { EcoLogMessage } from '../eco-log-message'

/**
 * Generic Operation Logger for transaction processing, signing services, and other
 * infrastructure operations that don't fit into specific business contexts.
 *
 * Used for:
 * - Smart wallet transaction processing
 * - Permit signature validation and processing
 * - Gas estimation operations
 * - Account deployment operations
 * - General system infrastructure operations
 */
export class GenericOperationLogger extends BaseStructuredLogger {
  /**
   * Standard logging method for generic operations
   */
  log(context: GenericOperationLogContext, message: string, properties?: object): void {
    const params: GenericOperationLogParams = {
      message,
      operationType: context.operationType || 'generic',
      status: context.status,
      duration: context.duration,
      properties,
    }
    const structure = EcoLogMessage.forGenericOperation(params)
    this.logStructured(structure, 'info')
  }

  /**
   * Error logging with operation context
   */
  error(
    context: GenericOperationLogContext,
    message: string,
    error?: Error,
    properties?: object,
  ): void {
    const params: GenericOperationLogParams = {
      message,
      operationType: context.operationType || 'generic',
      status: 'error',
      duration: context.duration,
      properties,
    }
    const structure = EcoLogMessage.forGenericOperation(params)
    this.logStructured(structure, 'error')
  }

  /**
   * Warning logging with operation context
   */
  warn(context: GenericOperationLogContext, message: string, properties?: object): void {
    const params: GenericOperationLogParams = {
      message,
      operationType: context.operationType || 'generic',
      status: context.status || 'warning',
      duration: context.duration,
      properties,
    }
    const structure = EcoLogMessage.forGenericOperation(params)
    this.logStructured(structure, 'warn')
  }

  /**
   * Debug logging with operation context
   */
  debug(context: GenericOperationLogContext, message: string, properties?: object): void {
    const params: GenericOperationLogParams = {
      message,
      operationType: context.operationType || 'generic',
      status: context.status,
      duration: context.duration,
      properties,
    }
    const structure = EcoLogMessage.forGenericOperation(params)
    this.logStructured(structure, 'debug')
  }

  /**
   * Log transaction processing operations
   */
  logTransaction(
    context: GenericOperationLogContext & {
      transactionHash?: string
      walletAddress?: string
      chainId?: number
    },
    message: string,
    properties?: object,
  ): void {
    this.log(
      {
        ...context,
        operationType: context.operationType || 'transaction',
      },
      message,
      {
        ...properties,
        transactionHash: context.transactionHash,
        walletAddress: context.walletAddress,
        chainId: context.chainId,
      },
    )
  }

  /**
   * Log permit signature operations
   */
  logSignature(
    context: GenericOperationLogContext & {
      permitType?: string
      signatureMethod?: string
    },
    message: string,
    properties?: object,
  ): void {
    this.log(
      {
        ...context,
        operationType: context.operationType || 'signature',
      },
      message,
      {
        ...properties,
        permitType: context.permitType,
        signatureMethod: context.signatureMethod,
      },
    )
  }
}
