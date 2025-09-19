import { Injectable } from '@nestjs/common'
import { HealthOperationLogger } from '@/common/logging/loggers'
import { RebalanceRepository } from './rebalance.repository'
import { RebalanceQuoteRejectionRepository } from './rebalance-quote-rejection.repository'

/**
 * Interface representing the overall health status of the rebalancing system.
 * Provides both boolean health status and detailed metrics for monitoring.
 */
export interface HealthStatus {
  /** Overall system health - false if system is down */
  isHealthy: boolean
  /** Number of successful rebalances in the monitored time period */
  successCount: number
  /** Number of rejected quotes in the monitored time period */
  rejectionCount: number
  /** Whether any rejections occurred in the last hour */
  lastHourHasRejections: boolean
  /** Whether any successful rebalances occurred in the last hour */
  lastHourHasSuccesses: boolean
  /** Human-readable explanation of the health status */
  healthReason: string
}

/**
 * Interface for detailed health metrics over a configurable time range.
 * Used for analytics and trend monitoring beyond basic health checks.
 */
export interface HealthMetrics {
  /** Time range in minutes for which metrics were calculated */
  timeRangeMinutes: number
  /** Number of successful rebalances in the time range */
  successCount: number
  /** Number of rejected quotes in the time range */
  rejectionCount: number
  /** Success rate as a percentage (0-100) */
  successRate: number
  /** Overall health status for this time range */
  isHealthy: boolean
  /** Human-readable explanation of the health status */
  healthReason: string
}

/**
 * Repository that centralizes all rebalancing health monitoring logic.
 *
 * This repository aggregates data from both successful rebalances and rejections
 * to provide comprehensive health status and metrics. It implements the core
 * business logic for determining system health based on rolling counters.
 *
 * Health Logic:
 * - System is DOWN if there are rejections in the last hour AND no successful rebalances
 * - System is UP in all other cases (idle, successful, or mixed states)
 * - Provides configurable time ranges for flexible monitoring
 *
 * Key Features:
 * - Boolean health checks for health indicators
 * - Detailed metrics for analytics and dashboards
 * - Comprehensive error handling and logging
 * - Separation of concerns from service layer
 */
@Injectable()
export class RebalancingHealthRepository {
  private logger = new HealthOperationLogger('RebalancingHealthRepository')

  constructor(
    private readonly rebalanceRepository: RebalanceRepository,
    private readonly rejectionRepository: RebalanceQuoteRejectionRepository,
  ) {}

  /**
   * Performs a comprehensive health check of the rebalancing system.
   *
   * This method aggregates data from the last hour to determine overall
   * system health. It's the primary method used by health indicators.
   *
   * @returns Promise<HealthStatus> - Complete health status with metrics and reasoning
   */
  async checkRebalancingHealth(): Promise<HealthStatus> {
    try {
      this.logger.log(
        {
          healthCheck: 'rebalancing-system',
        },
        'Checking rebalancing health status',
      )

      const [hasRejections, hasSuccesses, rejectionCount, successCount] = await Promise.all([
        this.rejectionRepository.hasRejectionsInLastHour(),
        this.rebalanceRepository.hasSuccessfulRebalancesInLastHour(),
        this.rejectionRepository.getRecentRejectionCount(60),
        this.rebalanceRepository.getRecentSuccessCount(60),
      ])

      const isHealthy = this.calculateHealthStatus(hasRejections, hasSuccesses)
      const healthReason = this.getHealthReason(
        hasRejections,
        hasSuccesses,
        rejectionCount,
        successCount,
      )

      const healthStatus: HealthStatus = {
        isHealthy,
        successCount,
        rejectionCount,
        lastHourHasRejections: hasRejections,
        lastHourHasSuccesses: hasSuccesses,
        healthReason,
      }

      this.logger.log(
        {
          healthCheck: 'rebalancing-system',
          status: healthStatus.isHealthy ? 'healthy' : 'unhealthy',
        },
        'Rebalancing health status calculated',
        {
          isHealthy: healthStatus.isHealthy,
          successCount: healthStatus.successCount,
          rejectionCount: healthStatus.rejectionCount,
          lastHourHasRejections: healthStatus.lastHourHasRejections,
          lastHourHasSuccesses: healthStatus.lastHourHasSuccesses,
          healthReason: healthStatus.healthReason,
        },
      )

      return healthStatus
    } catch (error) {
      this.logger.error(
        {
          healthCheck: 'rebalancing-system',
          status: 'unhealthy',
        },
        'Failed to check rebalancing health',
        error,
        {
          errorMessage: error.message,
        },
      )

      return {
        isHealthy: false,
        successCount: 0,
        rejectionCount: 0,
        lastHourHasRejections: false,
        lastHourHasSuccesses: false,
        healthReason: `Health check failed: ${error.message}`,
      }
    }
  }

  /**
   * Alias for checkRebalancingHealth() for consistent API naming.
   *
   * @returns Promise<HealthStatus> - Complete health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    return this.checkRebalancingHealth()
  }

  /**
   * Simple boolean health check for health indicators.
   *
   * This method provides a clean boolean response for systems that
   * only need to know if the rebalancing system is healthy or not.
   *
   * @returns Promise<boolean> - true if system is healthy, false otherwise
   */
  async isSystemHealthy(): Promise<boolean> {
    const healthStatus = await this.checkRebalancingHealth()
    return healthStatus.isHealthy
  }

  /**
   * Provides detailed health metrics over a configurable time range.
   *
   * This method is useful for analytics, dashboards, and trend monitoring.
   * It calculates success rates and provides detailed reasoning about
   * system performance over any time period.
   *
   * @param timeRangeMinutes - Time window in minutes for metrics calculation (default: 60)
   * @returns Promise<HealthMetrics> - Detailed metrics with success rates and reasoning
   */
  async getHealthMetrics(timeRangeMinutes: number = 60): Promise<HealthMetrics> {
    try {
      this.logger.log(
        {
          healthCheck: 'rebalancing-metrics',
        },
        'Getting health metrics',
        {
          timeRangeMinutes,
        },
      )

      const [successCount, rejectionCount] = await Promise.all([
        this.rebalanceRepository.getRecentSuccessCount(timeRangeMinutes),
        this.rejectionRepository.getRecentRejectionCount(timeRangeMinutes),
      ])

      const totalOperations = successCount + rejectionCount
      const successRate = totalOperations > 0 ? (successCount / totalOperations) * 100 : 0

      const isHealthy = this.calculateHealthStatusFromCounts(
        successCount,
        rejectionCount,
        timeRangeMinutes,
      )
      const healthReason = this.getHealthReasonFromMetrics(
        successCount,
        rejectionCount,
        successRate,
        timeRangeMinutes,
      )

      const metrics: HealthMetrics = {
        timeRangeMinutes,
        successCount,
        rejectionCount,
        successRate,
        isHealthy,
        healthReason,
      }

      this.logger.log(
        {
          healthCheck: 'rebalancing-metrics',
          status: metrics.isHealthy ? 'healthy' : 'unhealthy',
        },
        'Health metrics calculated',
        {
          timeRangeMinutes: metrics.timeRangeMinutes,
          successCount: metrics.successCount,
          rejectionCount: metrics.rejectionCount,
          successRate: metrics.successRate,
          isHealthy: metrics.isHealthy,
          healthReason: metrics.healthReason,
        },
      )

      return metrics
    } catch (error) {
      this.logger.error(
        {
          healthCheck: 'rebalancing-metrics',
          status: 'unhealthy',
        },
        'Failed to get health metrics',
        error,
        {
          timeRangeMinutes,
          errorMessage: error.message,
        },
      )

      return {
        timeRangeMinutes,
        successCount: 0,
        rejectionCount: 0,
        successRate: 0,
        isHealthy: false,
        healthReason: `Health metrics calculation failed: ${error.message}`,
      }
    }
  }

  /**
   * Core health calculation logic based on rejection and success activity.
   *
   * Health Rules:
   * - DOWN: Has rejections in last hour AND no successful rebalances
   * - UP: All other scenarios (idle, successful, or mixed states)
   *
   * @param hasRejections - Whether rejections occurred in the monitored period
   * @param hasSuccesses - Whether successful rebalances occurred in the monitored period
   * @returns boolean - true if system is healthy, false if down
   */
  private calculateHealthStatus(hasRejections: boolean, hasSuccesses: boolean): boolean {
    // System is DOWN if:
    // - There are rejections in the last hour AND no successful rebalances
    if (hasRejections && !hasSuccesses) {
      return false
    }

    // System is UP in all other cases:
    // - No rejections and no successes (idle state)
    // - No rejections but has successes (good state)
    // - Has rejections but also has successes (mixed but functioning state)
    return true
  }

  /**
   * Applies health calculation logic to raw counts over any time range.
   *
   * This method normalizes counts to hourly equivalents to maintain
   * consistency with the main health logic regardless of time range.
   *
   * @param successCount - Number of successful rebalances in the time range
   * @param rejectionCount - Number of rejections in the time range
   * @param timeRangeMinutes - Time range in minutes for normalization
   * @returns boolean - true if system is healthy, false if down
   */
  private calculateHealthStatusFromCounts(
    successCount: number,
    rejectionCount: number,
    timeRangeMinutes: number,
  ): boolean {
    // Convert to hour-equivalent for consistency with main health logic
    const hourEquivalent = timeRangeMinutes / 60
    const hourlySuccessCount = successCount / hourEquivalent
    const hourlyRejectionCount = rejectionCount / hourEquivalent

    return this.calculateHealthStatus(hourlyRejectionCount > 0, hourlySuccessCount > 0)
  }

  /**
   * Generates human-readable health status explanations.
   *
   * Provides clear messaging about why the system is in its current
   * health state, including relevant counts for context.
   *
   * @param hasRejections - Whether rejections occurred
   * @param hasSuccesses - Whether successes occurred
   * @param rejectionCount - Total rejection count
   * @param successCount - Total success count
   * @returns string - Human-readable health explanation
   */
  private getHealthReason(
    hasRejections: boolean,
    hasSuccesses: boolean,
    rejectionCount: number,
    successCount: number,
  ): string {
    if (hasRejections && !hasSuccesses) {
      return `System DOWN: ${rejectionCount} rejections in last hour with no successful rebalances`
    }

    if (!hasRejections && !hasSuccesses) {
      return 'System IDLE: No rebalancing activity in last hour'
    }

    if (!hasRejections && hasSuccesses) {
      return `System HEALTHY: ${successCount} successful rebalances with no rejections in last hour`
    }

    if (hasRejections && hasSuccesses) {
      return `System FUNCTIONAL: ${successCount} successes and ${rejectionCount} rejections in last hour`
    }

    return 'Unknown health state'
  }

  /**
   * Generates detailed health explanations for flexible time ranges.
   *
   * Provides comprehensive messaging including success rates and
   * time context for analytics and monitoring dashboards.
   *
   * @param successCount - Number of successful operations
   * @param rejectionCount - Number of rejected operations
   * @param successRate - Success rate as percentage
   * @param timeRangeMinutes - Time range for context
   * @returns string - Detailed health explanation
   */
  private getHealthReasonFromMetrics(
    successCount: number,
    rejectionCount: number,
    successRate: number,
    timeRangeMinutes: number,
  ): string {
    const totalOperations = successCount + rejectionCount

    if (totalOperations === 0) {
      return `System IDLE: No rebalancing activity in last ${timeRangeMinutes} minutes`
    }

    if (rejectionCount === 0) {
      return `System HEALTHY: ${successCount} successful rebalances (100% success rate) in last ${timeRangeMinutes} minutes`
    }

    if (successCount === 0) {
      return `System DOWN: ${rejectionCount} rejections (0% success rate) in last ${timeRangeMinutes} minutes`
    }

    return `System FUNCTIONAL: ${successCount} successes, ${rejectionCount} rejections (${successRate.toFixed(1)}% success rate) in last ${timeRangeMinutes} minutes`
  }
}
