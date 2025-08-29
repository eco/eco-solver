/**
 * Unit tests for LiquidityManagerModule
 *
 * Tests module registration, dependency injection, and schema configuration
 * to ensure all repositories and schemas are properly wired for Phase 3.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { createMock } from '@golevelup/ts-jest'
import { Model } from 'mongoose'
import { LiquidityManagerModule } from './liquidity-manager.module'
import { RebalanceRepository } from './repositories/rebalance.repository'
import { RebalanceQuoteRejectionRepository } from './repositories/rebalance-quote-rejection.repository'
import { RebalancingHealthRepository } from './repositories/rebalancing-health.repository'
import { LiquidityManagerService } from './services/liquidity-manager.service'
import { LiquidityProviderService } from './services/liquidity-provider.service'
import { RebalanceModel } from './schemas/rebalance.schema'
import { RebalanceQuoteRejectionModel } from './schemas/rebalance-quote-rejection.schema'

// Mock external modules
jest.mock('@/balance/balance.module', () => ({
  BalanceModule: {},
}))

jest.mock('@/intent/intent.module', () => ({
  IntentModule: {},
}))

jest.mock('@/transaction/transaction.module', () => ({
  TransactionModule: {},
}))

jest.mock('@/liquidity-manager/queues/liquidity-manager.queue', () => ({
  LiquidityManagerQueue: {
    init: () => ({ module: 'MockQueueModule' }),
    initFlow: () => ({ module: 'MockFlowModule' }),
  },
}))

jest.mock('@nestjs/cache-manager', () => ({
  CacheModule: {
    register: () => ({ module: 'MockCacheModule' }),
  },
}))

describe('LiquidityManagerModule', () => {
  let module: TestingModule
  let rebalanceRepository: RebalanceRepository
  let rejectionRepository: RebalanceQuoteRejectionRepository
  let healthRepository: RebalancingHealthRepository
  let liquidityManagerService: LiquidityManagerService
  let liquidityProviderService: LiquidityProviderService

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [LiquidityManagerModule],
    })
      .overrideProvider(getModelToken(RebalanceModel.name))
      .useValue(createMock<Model<RebalanceModel>>())
      .overrideProvider(getModelToken(RebalanceQuoteRejectionModel.name))
      .useValue(createMock<Model<RebalanceQuoteRejectionModel>>())
      .compile()

    rebalanceRepository = module.get<RebalanceRepository>(RebalanceRepository)
    rejectionRepository = module.get<RebalanceQuoteRejectionRepository>(
      RebalanceQuoteRejectionRepository,
    )
    healthRepository = module.get<RebalancingHealthRepository>(RebalancingHealthRepository)
    liquidityManagerService = module.get<LiquidityManagerService>(LiquidityManagerService)
    liquidityProviderService = module.get<LiquidityProviderService>(LiquidityProviderService)
  })

  afterEach(async () => {
    await module.close()
  })

  describe('Module Registration', () => {
    it('should compile the module successfully', () => {
      expect(module).toBeDefined()
    })

    it('should register RebalanceRepository in providers', () => {
      expect(rebalanceRepository).toBeDefined()
      expect(rebalanceRepository).toBeInstanceOf(RebalanceRepository)
    })

    it('should register RebalanceQuoteRejectionRepository in providers', () => {
      expect(rejectionRepository).toBeDefined()
      expect(rejectionRepository).toBeInstanceOf(RebalanceQuoteRejectionRepository)
    })

    it('should register RebalancingHealthRepository in providers', () => {
      expect(healthRepository).toBeDefined()
      expect(healthRepository).toBeInstanceOf(RebalancingHealthRepository)
    })

    it('should register LiquidityManagerService in providers', () => {
      expect(liquidityManagerService).toBeDefined()
      expect(liquidityManagerService).toBeInstanceOf(LiquidityManagerService)
    })

    it('should register LiquidityProviderService in providers', () => {
      expect(liquidityProviderService).toBeDefined()
      expect(liquidityProviderService).toBeInstanceOf(LiquidityProviderService)
    })
  })

  describe('Dependency Injection', () => {
    it('should inject RebalanceRepository into LiquidityManagerService', () => {
      // Access private property for testing dependency injection
      const injectedRepository = (liquidityManagerService as any).rebalanceRepository
      expect(injectedRepository).toBeDefined()
      expect(injectedRepository).toBeInstanceOf(RebalanceRepository)
    })

    it('should inject RebalanceQuoteRejectionRepository into LiquidityProviderService', () => {
      // Access private property for testing dependency injection
      const injectedRepository = (liquidityProviderService as any).rejectionRepository
      expect(injectedRepository).toBeDefined()
      expect(injectedRepository).toBeInstanceOf(RebalanceQuoteRejectionRepository)
    })

    it('should inject repositories into RebalancingHealthRepository', () => {
      // Access private properties for testing dependency injection
      const injectedRebalanceRepo = (healthRepository as any).rebalanceRepository
      const injectedRejectionRepo = (healthRepository as any).rejectionRepository

      expect(injectedRebalanceRepo).toBeDefined()
      expect(injectedRebalanceRepo).toBeInstanceOf(RebalanceRepository)

      expect(injectedRejectionRepo).toBeDefined()
      expect(injectedRejectionRepo).toBeInstanceOf(RebalanceQuoteRejectionRepository)
    })
  })

  describe('Schema Registration', () => {
    it('should register RebalanceModel schema with Mongoose', () => {
      const rebalanceModel = module.get(getModelToken(RebalanceModel.name))
      expect(rebalanceModel).toBeDefined()
    })

    it('should register RebalanceQuoteRejectionModel schema with Mongoose', () => {
      const rejectionModel = module.get(getModelToken(RebalanceQuoteRejectionModel.name))
      expect(rejectionModel).toBeDefined()
    })
  })

  describe('Module Exports', () => {
    it('should export LiquidityManagerService for other modules', () => {
      expect(() => module.get(LiquidityManagerService)).not.toThrow()
    })

    it('should export RebalanceRepository for other modules', () => {
      expect(() => module.get(RebalanceRepository)).not.toThrow()
    })

    it('should export RebalanceQuoteRejectionRepository for other modules', () => {
      expect(() => module.get(RebalanceQuoteRejectionRepository)).not.toThrow()
    })

    it('should export RebalancingHealthRepository for health module integration', () => {
      expect(() => module.get(RebalancingHealthRepository)).not.toThrow()
    })
  })

  describe('Integration Readiness', () => {
    it('should have all Phase 3 components ready for Phase 4 health integration', () => {
      // Verify all components needed for health monitoring are available
      expect(rebalanceRepository).toBeDefined()
      expect(rejectionRepository).toBeDefined()
      expect(healthRepository).toBeDefined()

      // Verify health repository has access to both data repositories
      const healthRepoRebalanceRepo = (healthRepository as any).rebalanceRepository
      const healthRepoRejectionRepo = (healthRepository as any).rejectionRepository

      expect(healthRepoRebalanceRepo).toBeInstanceOf(RebalanceRepository)
      expect(healthRepoRejectionRepo).toBeInstanceOf(RebalanceQuoteRejectionRepository)
    })

    it('should have all repositories properly configured for persistence operations', () => {
      // Verify each repository has its model injected
      const rebalanceModel = (rebalanceRepository as any).model
      const rejectionModel = (rejectionRepository as any).model

      expect(rebalanceModel).toBeDefined()
      expect(rejectionModel).toBeDefined()
    })
  })
})
