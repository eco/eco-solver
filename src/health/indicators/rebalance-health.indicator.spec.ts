/**
 * Unit tests for RebalanceHealthIndicator
 *
 * Tests simple delegation to RebalancingHealthRepository and proper health
 * status translation following the existing health indicator test patterns.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { HealthCheckError } from '@nestjs/terminus'
import { RebalanceHealthIndicator } from './rebalance-health.indicator'
import {
  RebalancingHealthRepository,
  HealthStatus,
} from '@/liquidity-manager/repositories/rebalancing-health.repository'

describe('RebalanceHealthIndicator', () => {
  let indicator: RebalanceHealthIndicator
  let healthRepository: RebalancingHealthRepository

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RebalanceHealthIndicator,
        {
          provide: RebalancingHealthRepository,
          useValue: createMock<RebalancingHealthRepository>(),
        },
      ],
    }).compile()

    indicator = module.get<RebalanceHealthIndicator>(RebalanceHealthIndicator)
    healthRepository = module.get<RebalancingHealthRepository>(RebalancingHealthRepository)
  })

  describe('checkRebalancingHealth', () => {
    it('should return healthy status when repository reports system is healthy', async () => {
      const mockHealthStatus: HealthStatus = {
        isHealthy: true,
        successCount: 5,
        rejectionCount: 1,
        lastHourHasRejections: true,
        lastHourHasSuccesses: true,
        healthReason: 'System FUNCTIONAL: 5 successes and 1 rejections in last hour',
      }

      jest.spyOn(healthRepository, 'checkRebalancingHealth').mockResolvedValue(mockHealthStatus)

      const result = await indicator.checkRebalancingHealth()

      expect(result).toEqual({
        rebalancing: {
          status: 'up',
          successCount: 5,
          rejectionCount: 1,
          lastHourHasRejections: true,
          lastHourHasSuccesses: true,
          healthReason: 'System FUNCTIONAL: 5 successes and 1 rejections in last hour',
        },
      })

      expect(healthRepository.checkRebalancingHealth).toHaveBeenCalledTimes(1)
    })

    it('should throw HealthCheckError when repository reports system is unhealthy', async () => {
      const mockHealthStatus: HealthStatus = {
        isHealthy: false,
        successCount: 0,
        rejectionCount: 3,
        lastHourHasRejections: true,
        lastHourHasSuccesses: false,
        healthReason: 'System DOWN: 3 rejections in last hour with no successful rebalances',
      }

      jest.spyOn(healthRepository, 'checkRebalancingHealth').mockResolvedValue(mockHealthStatus)

      await expect(indicator.checkRebalancingHealth()).rejects.toThrow(HealthCheckError)

      try {
        await indicator.checkRebalancingHealth()
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError)
        expect(error.message).toBe('Rebalancing system failed health check')
        expect(error.causes).toEqual({
          rebalancing: {
            status: 'down',
            successCount: 0,
            rejectionCount: 3,
            lastHourHasRejections: true,
            lastHourHasSuccesses: false,
            healthReason: 'System DOWN: 3 rejections in last hour with no successful rebalances',
          },
        })
      }

      expect(healthRepository.checkRebalancingHealth).toHaveBeenCalledTimes(2)
    })

    it('should handle repository errors gracefully', async () => {
      const repositoryError = new Error('Database connection failed')
      jest.spyOn(healthRepository, 'checkRebalancingHealth').mockRejectedValue(repositoryError)

      await expect(indicator.checkRebalancingHealth()).rejects.toThrow(HealthCheckError)

      try {
        await indicator.checkRebalancingHealth()
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError)
        expect(error.message).toBe('Rebalancing health check execution failed')
        expect(error.causes).toEqual({
          rebalancing: {
            status: 'down',
            error: 'Database connection failed',
            healthReason: 'Health check execution failed',
          },
        })
      }

      expect(healthRepository.checkRebalancingHealth).toHaveBeenCalledTimes(2)
    })

    it('should return idle system status when no activity in last hour', async () => {
      const mockHealthStatus: HealthStatus = {
        isHealthy: true,
        successCount: 0,
        rejectionCount: 0,
        lastHourHasRejections: false,
        lastHourHasSuccesses: false,
        healthReason: 'System IDLE: No rebalancing activity in last hour',
      }

      jest.spyOn(healthRepository, 'checkRebalancingHealth').mockResolvedValue(mockHealthStatus)

      const result = await indicator.checkRebalancingHealth()

      expect(result).toEqual({
        rebalancing: {
          status: 'up',
          successCount: 0,
          rejectionCount: 0,
          lastHourHasRejections: false,
          lastHourHasSuccesses: false,
          healthReason: 'System IDLE: No rebalancing activity in last hour',
        },
      })
    })

    it('should return healthy status when only successes occur', async () => {
      const mockHealthStatus: HealthStatus = {
        isHealthy: true,
        successCount: 10,
        rejectionCount: 0,
        lastHourHasRejections: false,
        lastHourHasSuccesses: true,
        healthReason: 'System HEALTHY: 10 successful rebalances with no rejections in last hour',
      }

      jest.spyOn(healthRepository, 'checkRebalancingHealth').mockResolvedValue(mockHealthStatus)

      const result = await indicator.checkRebalancingHealth()

      expect(result).toEqual({
        rebalancing: {
          status: 'up',
          successCount: 10,
          rejectionCount: 0,
          lastHourHasRejections: false,
          lastHourHasSuccesses: true,
          healthReason: 'System HEALTHY: 10 successful rebalances with no rejections in last hour',
        },
      })
    })
  })

  describe('integration with health system', () => {
    it('should delegate all business logic to repository', async () => {
      const mockHealthStatus: HealthStatus = {
        isHealthy: true,
        successCount: 2,
        rejectionCount: 1,
        lastHourHasRejections: true,
        lastHourHasSuccesses: true,
        healthReason: 'Mixed activity detected',
      }

      jest.spyOn(healthRepository, 'checkRebalancingHealth').mockResolvedValue(mockHealthStatus)

      await indicator.checkRebalancingHealth()

      // Verify the indicator only calls the repository and doesn't implement business logic
      expect(healthRepository.checkRebalancingHealth).toHaveBeenCalledWith()
      expect(healthRepository.checkRebalancingHealth).toHaveBeenCalledTimes(1)
    })

    it('should follow the existing health indicator pattern for status translation', async () => {
      const mockHealthStatus: HealthStatus = {
        isHealthy: true,
        successCount: 1,
        rejectionCount: 0,
        lastHourHasRejections: false,
        lastHourHasSuccesses: true,
        healthReason: 'Test reason',
      }

      jest.spyOn(healthRepository, 'checkRebalancingHealth').mockResolvedValue(mockHealthStatus)

      const result = await indicator.checkRebalancingHealth()

      // Verify it follows the same pattern as other indicators (key matches method name)
      expect(result).toHaveProperty('rebalancing')
      expect(result.rebalancing).toHaveProperty('status', 'up')
    })
  })
})
