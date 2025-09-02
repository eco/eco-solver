import { EcoLogMessage } from '../eco-log-message'
import { EcoError } from '../../errors/eco-error'
import { HealthOperationLogContext } from '../types'
import { BaseStructuredLogger } from './base-structured-logger'

/**
 * Specialized logger for health check operations
 */
export class HealthOperationLogger extends BaseStructuredLogger {
  constructor(context: string = 'HealthCheck') {
    super(context)
  }

  /**
   * Log a health check message with structured context
   */
  log(context: HealthOperationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.forHealthOperation({
      message,
      healthCheck: context.healthCheck,
      status: 'healthy',
      dependencies: context.dependencies,
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log a health check error with structured context
   */
  error(
    context: HealthOperationLogContext,
    message: string,
    error?: Error,
    properties?: object,
  ): void {
    if (error && error instanceof EcoError) {
      const structure = EcoLogMessage.withEnhancedError(message, error, 'error', {
        health: {
          health_check: context.healthCheck,
          dependencies: context.dependencies,
        },
        ...properties,
      })
      this.logStructured(structure, 'error')
    } else {
      const structure = EcoLogMessage.forHealthOperation({
        message,
        healthCheck: context.healthCheck,
        status: 'unhealthy',
        dependencies: context.dependencies,
        properties: { error: error?.toString(), ...properties },
      })
      this.logStructured(structure, 'error')
    }
  }

  /**
   * Log a health check warning with structured context
   */
  warn(context: HealthOperationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.forHealthOperation({
      message,
      healthCheck: context.healthCheck,
      status: 'degraded',
      dependencies: context.dependencies,
      properties,
    })
    this.logStructured(structure, 'warn')
  }

  /**
   * Log a health check debug message with structured context
   */
  debug(context: HealthOperationLogContext, message: string, properties?: object): void {
    const structure = EcoLogMessage.forHealthOperation({
      message,
      healthCheck: context.healthCheck,
      status: 'healthy',
      dependencies: context.dependencies,
      properties,
    })
    this.logStructured(structure, 'debug')
  }

  /**
   * Log health check success
   */
  logHealthy(context: HealthOperationLogContext, responseTime: number, properties?: object): void {
    const structure = EcoLogMessage.forHealthOperation({
      message: `Health check passed: ${context.healthCheck}`,
      healthCheck: context.healthCheck,
      status: 'healthy',
      responseTime,
      dependencies: context.dependencies,
      properties,
    })
    this.logStructured(structure, 'info')
  }

  /**
   * Log health check degradation
   */
  logDegraded(context: HealthOperationLogContext, responseTime: number, properties?: object): void {
    const structure = EcoLogMessage.forHealthOperation({
      message: `Health check degraded: ${context.healthCheck}`,
      healthCheck: context.healthCheck,
      status: 'degraded',
      responseTime,
      dependencies: context.dependencies,
      properties,
    })
    this.logStructured(structure, 'warn')
  }

  /**
   * Log health check failure
   */
  logUnhealthy(context: HealthOperationLogContext, error: Error, properties?: object): void {
    const structure = EcoLogMessage.forHealthOperation({
      message: `Health check failed: ${context.healthCheck}`,
      healthCheck: context.healthCheck,
      status: 'unhealthy',
      dependencies: context.dependencies,
      properties: { error: error.toString(), ...properties },
    })
    this.logStructured(structure, 'error')
  }
}
