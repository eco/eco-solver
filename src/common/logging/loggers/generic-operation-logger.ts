import { BaseStructuredLogger } from './base-structured-logger'
import { EcoLogMessage } from '../eco-log-message'
import { GenericOperationLogContext, GenericOperationLogParams } from '../types'

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

  // ================== PROCESSOR-SPECIFIC BUSINESS EVENT METHODS ==================

  /**
   * Log processor job start events
   */
  logProcessorJobStart(processorType: string, jobId: string, intentHash: string): void {
    const context = {
      eco: {
        processor_type: processorType,
        job_id: jobId,
        intent_hash: intentHash,
      },
      job_processing: {
        job_status: 'started',
        processing_stage: 'initialization',
      },
      operation: {
        business_event: 'processor_job_started',
        action_taken: 'begin_job_processing',
      },
    }

    this.logMessage(context, 'info', `Processor ${processorType} started job ${jobId}`)
  }

  /**
   * Log processor job completion events
   */
  logProcessorJobComplete(processorType: string, jobId: string, processingTime: number): void {
    const context = {
      eco: {
        processor_type: processorType,
        job_id: jobId,
      },
      job_processing: {
        job_status: 'completed',
        processing_stage: 'finalized',
        processing_time_ms: processingTime,
      },
      operation: {
        business_event: 'processor_job_completed',
        action_taken: 'complete_job_processing',
      },
    }

    this.logMessage(
      context,
      'info',
      `Processor ${processorType} completed job ${jobId} in ${processingTime}ms`,
    )
  }

  /**
   * Log processor job failure events
   */
  logProcessorJobFailed(processorType: string, jobId: string, error: Error): void {
    const context = {
      eco: {
        processor_type: processorType,
        job_id: jobId,
      },
      job_processing: {
        job_status: 'failed',
        processing_stage: 'error',
        error_type: error.name,
        error_message: error.message,
      },
      operation: {
        business_event: 'processor_job_failed',
        action_taken: 'mark_job_failed',
      },
    }

    this.logMessage(
      context,
      'error',
      `Processor ${processorType} job ${jobId} failed: ${error.message}`,
    )
  }

  /**
   * Log queue processing events
   */
  logQueueProcessing(
    queueName: string,
    jobCount: number,
    processingStatus: 'active' | 'waiting' | 'completed',
  ): void {
    const context = {
      queue_processing: {
        queue_name: queueName,
        job_count: jobCount,
        queue_status: processingStatus,
      },
      operation: {
        business_event: 'queue_processing_status',
        action_taken: 'update_queue_metrics',
      },
    }

    this.logMessage(context, 'debug', `Queue ${queueName}: ${jobCount} jobs ${processingStatus}`)
  }

  /**
   * Log infrastructure service operations
   */
  logInfrastructureOperation(
    serviceName: string,
    operation: string,
    success: boolean,
    details?: Record<string, any>,
  ): void {
    const context = {
      infrastructure: {
        service_name: serviceName,
        operation_type: operation,
        operation_success: success,
        ...details,
      },
      operation: {
        business_event: 'infrastructure_operation',
        action_taken: success ? 'operation_completed' : 'operation_failed',
      },
    }

    this.logMessage(
      context,
      success ? 'info' : 'error',
      `Infrastructure ${serviceName}: ${operation} ${success ? 'completed' : 'failed'}`,
    )
  }
}
