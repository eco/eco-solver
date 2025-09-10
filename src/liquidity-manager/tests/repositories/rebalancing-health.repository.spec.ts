/**
 * Unit tests for RebalancingHealthRepository
 *
 * Tests comprehensive health monitoring logic that aggregates success and failure data
 * to determine system health. Validates the core business rules for health calculation
 * and ensures proper error handling and messaging for different system states.
 */
import { Test, TestingModule } from '@nestjs/testing'
import {
  RebalancingHealthRepository,
  HealthStatus,
  HealthMetrics,
} from '@/liquidity-manager/repositories/rebalancing-health.repository'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceQuoteRejectionRepository } from '@/liquidity-manager/repositories/rebalance-quote-rejection.repository'

describe('RebalancingHealthRepository', () => {
  let repository: RebalancingHealthRepository
  let rebalanceRepository: jest.Mocked<RebalanceRepository>
  let rejectionRepository: jest.Mocked<RebalanceQuoteRejectionRepository>

  beforeEach(async () => {
    const mockRebalanceRepository = {
      hasSuccessfulRebalancesInLastHour: jest.fn(),
      getRecentSuccessCount: jest.fn(),
    }

    const mockRejectionRepository = {
      hasRejectionsInLastHour: jest.fn(),
      getRecentRejectionCount: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RebalancingHealthRepository,
        {
          provide: RebalanceRepository,
          useValue: mockRebalanceRepository,
        },
        {
          provide: RebalanceQuoteRejectionRepository,
          useValue: mockRejectionRepository,
        },
      ],
    }).compile()

    repository = module.get<RebalancingHealthRepository>(RebalancingHealthRepository)
    rebalanceRepository = module.get<RebalanceRepository>(
      RebalanceRepository,
    ) as jest.Mocked<RebalanceRepository>
    rejectionRepository = module.get<RebalanceQuoteRejectionRepository>(
      RebalanceQuoteRejectionRepository,
    ) as jest.Mocked<RebalanceQuoteRejectionRepository>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // Test core health logic covering all possible system states
  describe('checkRebalancingHealth', () => {
    it('should return healthy status when no rejections and has successes', async () => {
      rejectionRepository.hasRejectionsInLastHour.mockResolvedValue(false)
      rebalanceRepository.hasSuccessfulRebalancesInLastHour.mockResolvedValue(true)
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(0)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(5)

      const result = await repository.checkRebalancingHealth()

      expect(result.isHealthy).toBe(true)
      expect(result.successCount).toBe(5)
      expect(result.rejectionCount).toBe(0)
      expect(result.lastHourHasRejections).toBe(false)
      expect(result.lastHourHasSuccesses).toBe(true)
      expect(result.healthReason).toContain('HEALTHY')
    })

    it('should return unhealthy status when has rejections but no successes', async () => {
      rejectionRepository.hasRejectionsInLastHour.mockResolvedValue(true)
      rebalanceRepository.hasSuccessfulRebalancesInLastHour.mockResolvedValue(false)
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(3)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(0)

      const result = await repository.checkRebalancingHealth()

      expect(result.isHealthy).toBe(false)
      expect(result.successCount).toBe(0)
      expect(result.rejectionCount).toBe(3)
      expect(result.lastHourHasRejections).toBe(true)
      expect(result.lastHourHasSuccesses).toBe(false)
      expect(result.healthReason).toContain('System DOWN')
    })

    it('should return healthy status when has both rejections and successes', async () => {
      rejectionRepository.hasRejectionsInLastHour.mockResolvedValue(true)
      rebalanceRepository.hasSuccessfulRebalancesInLastHour.mockResolvedValue(true)
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(2)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(8)

      const result = await repository.checkRebalancingHealth()

      expect(result.isHealthy).toBe(true)
      expect(result.successCount).toBe(8)
      expect(result.rejectionCount).toBe(2)
      expect(result.healthReason).toContain('FUNCTIONAL')
    })

    it('should return healthy idle status when no activity', async () => {
      rejectionRepository.hasRejectionsInLastHour.mockResolvedValue(false)
      rebalanceRepository.hasSuccessfulRebalancesInLastHour.mockResolvedValue(false)
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(0)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(0)

      const result = await repository.checkRebalancingHealth()

      expect(result.isHealthy).toBe(true)
      expect(result.successCount).toBe(0)
      expect(result.rejectionCount).toBe(0)
      expect(result.healthReason).toContain('IDLE')
    })

    it('should handle errors gracefully', async () => {
      rejectionRepository.hasRejectionsInLastHour.mockRejectedValue(new Error('Database error'))

      const result = await repository.checkRebalancingHealth()

      expect(result.isHealthy).toBe(false)
      expect(result.healthReason).toContain('Health check failed')
    })
  })

  // Test API consistency between different health methods
  describe('getHealthStatus', () => {
    it('should return the same result as checkRebalancingHealth', async () => {
      rejectionRepository.hasRejectionsInLastHour.mockResolvedValue(false)
      rebalanceRepository.hasSuccessfulRebalancesInLastHour.mockResolvedValue(true)
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(0)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(3)

      const checkResult = await repository.checkRebalancingHealth()
      const getResult = await repository.getHealthStatus()

      expect(getResult).toEqual(checkResult)
    })
  })

  // Test boolean health checks for health indicators
  describe('isSystemHealthy', () => {
    it('should return true when system is healthy', async () => {
      rejectionRepository.hasRejectionsInLastHour.mockResolvedValue(false)
      rebalanceRepository.hasSuccessfulRebalancesInLastHour.mockResolvedValue(true)
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(0)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(5)

      const result = await repository.isSystemHealthy()

      expect(result).toBe(true)
    })

    it('should return false when system is unhealthy', async () => {
      rejectionRepository.hasRejectionsInLastHour.mockResolvedValue(true)
      rebalanceRepository.hasSuccessfulRebalancesInLastHour.mockResolvedValue(false)
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(3)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(0)

      const result = await repository.isSystemHealthy()

      expect(result).toBe(false)
    })
  })

  // Test detailed metrics calculation with configurable time ranges
  describe('getHealthMetrics', () => {
    it('should return detailed metrics for healthy system', async () => {
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(1)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(9)

      const result = await repository.getHealthMetrics(60)

      expect(result.timeRangeMinutes).toBe(60)
      expect(result.successCount).toBe(9)
      expect(result.rejectionCount).toBe(1)
      expect(result.successRate).toBe(90)
      expect(result.isHealthy).toBe(true)
      expect(result.healthReason).toContain('FUNCTIONAL')
    })

    it('should return 100% success rate when no rejections', async () => {
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(0)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(10)

      const result = await repository.getHealthMetrics(30)

      expect(result.successRate).toBe(100)
      expect(result.isHealthy).toBe(true)
      expect(result.healthReason).toContain('HEALTHY')
    })

    it('should return 0% success rate when only rejections', async () => {
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(5)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(0)

      const result = await repository.getHealthMetrics(60)

      expect(result.successRate).toBe(0)
      expect(result.isHealthy).toBe(false)
      expect(result.healthReason).toContain('System DOWN')
    })

    it('should handle idle system with no activity', async () => {
      rejectionRepository.getRecentRejectionCount.mockResolvedValue(0)
      rebalanceRepository.getRecentSuccessCount.mockResolvedValue(0)

      const result = await repository.getHealthMetrics(120)

      expect(result.successRate).toBe(0)
      expect(result.isHealthy).toBe(true)
      expect(result.healthReason).toContain('IDLE')
    })

    it('should handle errors in metrics calculation', async () => {
      rejectionRepository.getRecentRejectionCount.mockRejectedValue(new Error('Database error'))

      const result = await repository.getHealthMetrics(60)

      expect(result.isHealthy).toBe(false)
      expect(result.healthReason).toContain('Health metrics calculation failed')
    })
  })

  // Test core business logic through public interface (private methods)
  describe('private methods via public interface', () => {
    it('should correctly calculate health status for various scenarios', async () => {
      const scenarios = [
        { hasRejections: false, hasSuccesses: false, expectedHealth: true }, // idle
        { hasRejections: false, hasSuccesses: true, expectedHealth: true }, // healthy
        { hasRejections: true, hasSuccesses: false, expectedHealth: false }, // down
        { hasRejections: true, hasSuccesses: true, expectedHealth: true }, // functional
      ]

      for (const scenario of scenarios) {
        rejectionRepository.hasRejectionsInLastHour.mockResolvedValue(scenario.hasRejections)
        rebalanceRepository.hasSuccessfulRebalancesInLastHour.mockResolvedValue(
          scenario.hasSuccesses,
        )
        rejectionRepository.getRecentRejectionCount.mockResolvedValue(
          scenario.hasRejections ? 1 : 0,
        )
        rebalanceRepository.getRecentSuccessCount.mockResolvedValue(scenario.hasSuccesses ? 1 : 0)

        const result = await repository.checkRebalancingHealth()
        expect(result.isHealthy).toBe(scenario.expectedHealth)
      }
    })
  })
})
