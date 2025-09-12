import { EcoError } from '../../errors/eco-error'
import { EcoLogMessage } from '../eco-log-message'
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

  // ================== HEALTH & MONITORING BUSINESS EVENT METHODS ==================

  /**
   * Log health check start events
   */
  logHealthCheckStart(checkType: string, target: string): void {
    const context = {
      health: {
        health_check_type: checkType,
        target_component: target,
        check_status: 'started',
      },
      operation: {
        business_event: 'health_check_started',
        action_taken: 'begin_health_check',
      },
    }

    this.logMessage(context, 'debug', `Health check started: ${checkType} for ${target}`)
  }

  /**
   * Log health check result events
   */
  logHealthCheckResult(checkType: string, target: string, healthy: boolean, details?: any): void {
    const context = {
      health: {
        health_check_type: checkType,
        target_component: target,
        check_status: healthy ? 'healthy' : 'unhealthy',
        check_details: details,
      },
      operation: {
        business_event: 'health_check_completed',
        action_taken: healthy ? 'mark_healthy' : 'mark_unhealthy',
      },
    }

    this.logMessage(
      context,
      healthy ? 'info' : 'error',
      `Health check ${healthy ? 'passed' : 'failed'}: ${checkType} for ${target}`,
    )
  }

  /**
   * Log monitoring alerts
   */
  logMonitoringAlert(
    alertType: string,
    severity: 'low' | 'medium' | 'high',
    message: string,
  ): void {
    const context = {
      monitoring: {
        alert_type: alertType,
        alert_severity: severity,
        alert_message: message,
      },
      operation: {
        business_event: 'monitoring_alert_triggered',
        action_taken: 'send_alert',
      },
    }

    const logLevel = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info'
    this.logMessage(context, logLevel, `${severity.toUpperCase()} alert: ${alertType} - ${message}`)
  }

  /**
   * Log system status change events
   */
  logSystemStatusChange(component: string, fromStatus: string, toStatus: string): void {
    const context = {
      system: {
        component_name: component,
        previous_status: fromStatus,
        current_status: toStatus,
        status_changed: true,
      },
      operation: {
        business_event: 'system_status_change',
        action_taken: 'update_component_status',
      },
    }

    const logLevel = toStatus === 'healthy' ? 'info' : toStatus === 'unhealthy' ? 'error' : 'warn'
    this.logMessage(
      context,
      logLevel,
      `System status change: ${component} ${fromStatus} → ${toStatus}`,
    )
  }
}
