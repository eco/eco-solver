import { Controller, Get } from '@nestjs/common'
import { BaseStructuredLogger } from '@/common/logging/loggers/base-structured-logger'
import { API_ROOT } from '@/common/routes/constants'
import { HealthPath } from '@/health/constants'

/**
 * Controller for logging system performance and compliance metrics
 */
@Controller(API_ROOT)
export class LoggingMetricsController {
  @Get(`${HealthPath}/metrics`)
  async getLoggingMetrics() {
    const metrics = BaseStructuredLogger.getLoggingMetrics()

    return {
      timestamp: new Date().toISOString(),
      logging_performance: {
        average_validation_time_ms: metrics.averageValidationTimeMs,
        average_log_size_bytes: metrics.averageLogSizeBytes,
        samples_processed: metrics.samplesProcessed,
      },
      datadog_compliance: {
        total_truncations: metrics.totalTruncations,
        total_warnings: metrics.totalWarnings,
        truncation_rate:
          metrics.samplesProcessed > 0 ? metrics.totalTruncations / metrics.samplesProcessed : 0,
        warning_rate:
          metrics.samplesProcessed > 0 ? metrics.totalWarnings / metrics.samplesProcessed : 0,
      },
      system_health: {
        status: this.getHealthStatus(metrics),
        recommendations: this.getRecommendations(metrics),
      },
    }
  }

  private getHealthStatus(metrics: any): 'healthy' | 'warning' | 'critical' {
    const avgValidationTime = metrics.averageValidationTimeMs
    const truncationRate =
      metrics.samplesProcessed > 0 ? metrics.totalTruncations / metrics.samplesProcessed : 0

    // Critical: Very high validation time or high truncation rate
    if (avgValidationTime > 10 || truncationRate > 0.1) {
      return 'critical'
    }

    // Warning: Moderate validation time or some truncations
    if (avgValidationTime > 5 || truncationRate > 0.05) {
      return 'warning'
    }

    return 'healthy'
  }

  private getRecommendations(metrics: any): string[] {
    const recommendations: string[] = []
    const avgValidationTime = metrics.averageValidationTimeMs
    const avgLogSize = metrics.averageLogSizeBytes
    const truncationRate =
      metrics.samplesProcessed > 0 ? metrics.totalTruncations / metrics.samplesProcessed : 0

    if (avgValidationTime > 5) {
      recommendations.push(
        'Consider reducing log payload size or disabling Datadog optimization for high-volume endpoints',
      )
    }

    if (avgLogSize > 10000) {
      recommendations.push(
        'Large log payloads detected - review property inclusion and consider data summarization',
      )
    }

    if (truncationRate > 0.05) {
      recommendations.push(
        'High truncation rate detected - review log structure and consider reducing nested object complexity',
      )
    }

    if (metrics.totalWarnings > 100) {
      recommendations.push(
        'Frequent validation warnings - consider adjusting log structure to meet Datadog limits',
      )
    }

    if (recommendations.length === 0) {
      recommendations.push('Logging system is operating within optimal parameters')
    }

    return recommendations
  }
}
