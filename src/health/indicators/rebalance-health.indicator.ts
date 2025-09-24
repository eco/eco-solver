import { Injectable } from '@nestjs/common'
import { HealthOperationLogger } from '@/common/logging/loggers'
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import { RebalancingHealthRepository } from '@/liquidity-manager/repositories/rebalancing-health.repository'

/**
 * Health indicator for the rebalancing system.
 *
 * This indicator provides a simple delegation to the RebalancingHealthRepository
 * which contains all the business logic for determining system health based on
 * success/failure ratios of rebalance operations and quote rejections.
 *
 * The indicator follows the existing pattern of minimal logic in the health layer
 * with comprehensive business logic in the repository layer.
 */
@Injectable()
export class RebalanceHealthIndicator extends HealthIndicator {
  private logger = new HealthOperationLogger('RebalanceHealthIndicator')

  constructor(private readonly rebalancingHealthRepository: RebalancingHealthRepository) {
    super()
  }

  /**
   * Performs a health check of the rebalancing system.
   *
   * This method delegates to the RebalancingHealthRepository which implements
   * the core health logic:
   * - System is DOWN if there are rejections in the last hour AND no successful rebalances
   * - System is UP in all other cases (idle, successful, or mixed states)
   *
   * @returns HealthIndicatorResult indicating system health status
   */
  async checkRebalancingHealth(): Promise<HealthIndicatorResult> {
    try {
      this.logger.log(
        {
          healthCheck: 'rebalancing',
          status: 'started',
        },
        'Checking rebalancing system health',
      )

      const healthStatus = await this.rebalancingHealthRepository.checkRebalancingHealth()

      this.logger.log(
        {
          healthCheck: 'rebalancing',
          status: healthStatus.isHealthy ? 'healthy' : 'unhealthy',
        },
        `Rebalancing health check result: ${healthStatus.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`,
        {
          successCount: healthStatus.successCount,
          rejectionCount: healthStatus.rejectionCount,
          lastHourHasRejections: healthStatus.lastHourHasRejections,
          lastHourHasSuccesses: healthStatus.lastHourHasSuccesses,
          healthReason: healthStatus.healthReason,
        },
      )

      const result = this.getStatus('rebalancing', healthStatus.isHealthy, {
        successCount: healthStatus.successCount,
        rejectionCount: healthStatus.rejectionCount,
        lastHourHasRejections: healthStatus.lastHourHasRejections,
        lastHourHasSuccesses: healthStatus.lastHourHasSuccesses,
        healthReason: healthStatus.healthReason,
      })

      if (healthStatus.isHealthy) {
        return result
      }

      throw new HealthCheckError('Rebalancing system failed health check', result)
    } catch (error) {
      // If it's already a HealthCheckError (from unhealthy status), re-throw it
      if (error instanceof HealthCheckError) {
        throw error
      }

      this.logger.error(
        {
          healthCheck: 'rebalancing',
          status: 'unhealthy',
        },
        'Rebalancing health check failed',
        error,
      )

      // Create a failed health result for execution errors only
      const failedResult = this.getStatus('rebalancing', false, {
        error: error.message,
        healthReason: 'Health check execution failed',
      })

      throw new HealthCheckError('Rebalancing health check execution failed', failedResult)
    }
  }
}
