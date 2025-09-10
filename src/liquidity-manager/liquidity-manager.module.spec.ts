/**
 * Unit tests for LiquidityManagerModule Core Components
 *
 * Tests the essential repository components and their dependencies without
 * the full complexity of all provider services and external module dependencies.
 * Focuses on verifying that the core data layer (repositories and schemas)
 * are properly wired for Phase 3 integration.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { createMock } from '@golevelup/ts-jest'
import { Model } from 'mongoose'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { getQueueToken } from '@nestjs/bullmq'
import { RebalanceRepository } from './repositories/rebalance.repository'
import { RebalanceQuoteRejectionRepository } from './repositories/rebalance-quote-rejection.repository'
import { RebalancingHealthRepository } from './repositories/rebalancing-health.repository'
import { LiquidityManagerService } from './services/liquidity-manager.service'
import { LiquidityProviderService } from './services/liquidity-provider.service'
import { RebalanceModel } from './schemas/rebalance.schema'
import { RebalanceQuoteRejectionModel } from './schemas/rebalance-quote-rejection.schema'
import { LiquidityManagerQueue } from './queues/liquidity-manager.queue'
import { CheckBalancesQueue } from './queues/check-balances.queue'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { BalanceService } from '@/balance/balance.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { getFlowProducerToken } from '@nestjs/bullmq'

// Mock external modules
jest.mock('@/balance/balance.module', () => ({
  BalanceModule: class MockBalanceModule {},
}))

jest.mock('@/intent/intent.module', () => ({
  IntentModule: class MockIntentModule {},
}))

jest.mock('@/transaction/transaction.module', () => ({
  TransactionModule: class MockTransactionModule {},
}))

jest.mock('@/liquidity-manager/queues/liquidity-manager.queue', () => ({
  LiquidityManagerQueue: {
    init: () => class MockLiquidityManagerQueueModule {},
    initFlow: () => class MockFlowModule {},
  },
}))

jest.mock('@/liquidity-manager/queues/check-balances.queue', () => ({
  CheckBalancesQueue: {
    init: () => class MockCheckBalancesQueueModule {},
  },
}))

jest.mock('@nestjs/cache-manager', () => ({
  CacheModule: {
    register: () => class MockCacheModule {},
  },
}))

describe('LiquidityManagerModule Components', () => {
  let module: TestingModule
  let rebalanceRepository: RebalanceRepository
  let rejectionRepository: RebalanceQuoteRejectionRepository
  let healthRepository: RebalancingHealthRepository

  beforeEach(async () => {
    // Focus on core repositories - the most important components for the module test
    module = await Test.createTestingModule({
      providers: [
        // Core repositories only - these are the key components we need to verify
        RebalanceRepository,
        RebalanceQuoteRejectionRepository,
        RebalancingHealthRepository,

        // Mock their minimal dependencies
        {
          provide: getModelToken(RebalanceModel.name),
          useValue: createMock<Model<RebalanceModel>>(),
        },
        {
          provide: getModelToken(RebalanceQuoteRejectionModel.name),
          useValue: createMock<Model<RebalanceQuoteRejectionModel>>(),
        },
      ],
    }).compile()

    rebalanceRepository = module.get<RebalanceRepository>(RebalanceRepository)
    rejectionRepository = module.get<RebalanceQuoteRejectionRepository>(
      RebalanceQuoteRejectionRepository,
    )
    healthRepository = module.get<RebalancingHealthRepository>(RebalancingHealthRepository)
  })

  afterEach(async () => {
    await module.close()
  })

  describe('Component Registration', () => {
    it('should compile the test module successfully', () => {
      expect(module).toBeDefined()
    })

    it('should provide RebalanceRepository', () => {
      expect(rebalanceRepository).toBeDefined()
      expect(rebalanceRepository).toBeInstanceOf(RebalanceRepository)
    })

    it('should provide RebalanceQuoteRejectionRepository', () => {
      expect(rejectionRepository).toBeDefined()
      expect(rejectionRepository).toBeInstanceOf(RebalanceQuoteRejectionRepository)
    })

    it('should provide RebalancingHealthRepository', () => {
      expect(healthRepository).toBeDefined()
      expect(healthRepository).toBeInstanceOf(RebalancingHealthRepository)
    })
  })

  describe('Model Dependencies', () => {
    it('should provide RebalanceModel', () => {
      const rebalanceModel = module.get(getModelToken(RebalanceModel.name))
      expect(rebalanceModel).toBeDefined()
    })

    it('should provide RebalanceQuoteRejectionModel', () => {
      const rejectionModel = module.get(getModelToken(RebalanceQuoteRejectionModel.name))
      expect(rejectionModel).toBeDefined()
    })
  })

  describe('Repository Access', () => {
    it('should provide access to RebalanceRepository', () => {
      expect(() => module.get(RebalanceRepository)).not.toThrow()
    })

    it('should provide access to RebalanceQuoteRejectionRepository', () => {
      expect(() => module.get(RebalanceQuoteRejectionRepository)).not.toThrow()
    })

    it('should provide access to RebalancingHealthRepository', () => {
      expect(() => module.get(RebalancingHealthRepository)).not.toThrow()
    })
  })

  describe('Integration Readiness', () => {
    it('should have all Phase 3 repository components ready for integration', () => {
      // Verify all repository components are available
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
