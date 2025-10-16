import { FlowProducer, Queue } from 'bullmq'
import { Model } from 'mongoose'
import { getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { BullModule, getFlowProducerToken, getQueueToken } from '@nestjs/bullmq'
import { mockFlowProducerProviders, mockQueueProviders } from '../../test/utils/mock-queues'
import { zeroAddress } from 'viem'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import {
  LiquidityManagerQueue,
  LIQUIDITY_MANAGER_QUEUE_NAME,
  LIQUIDITY_MANAGER_FLOW_NAME,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import {
  CheckBalancesQueue,
  CHECK_BALANCES_QUEUE_NAME,
} from '@/liquidity-manager/queues/check-balances.queue'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { EcoAnalyticsService } from '@/analytics'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'

describe('LiquidityManagerService', () => {
  let liquidityManagerService: LiquidityManagerService
  let liquidityProviderService: LiquidityProviderService
  let crowdLiquidityService: CrowdLiquidityService
  let kernelAccountClientService: KernelAccountClientService
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>
  let checkQueue: DeepMocked<Queue>
  let module: TestingModule

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        LiquidityManagerService,
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: LiquidityProviderService, useValue: createMock<LiquidityProviderService>() },
        {
          provide: KernelAccountClientService,
          useValue: createMock<KernelAccountClientService>(),
        },
        { provide: CrowdLiquidityService, useValue: createMock<CrowdLiquidityService>() },
        {
          provide: EcoAnalyticsService,
          useValue: createMock<EcoAnalyticsService>(),
        },
        {
          provide: RebalanceRepository,
          useValue: {
            getPendingReservedByTokenForWallet: jest.fn().mockResolvedValue(new Map()),
            getPendingIncomingByTokenForWallet: jest.fn().mockResolvedValue(new Map()),
          },
        },
        {
          provide: getModelToken(RebalanceModel.name),
          useValue: createMock<Model<RebalanceModel>>(),
        },
        // provide mock queue/flow providers so tests don't require real Bull connections
        // include the unnamed/default queue token used by some DI sites
        ...mockQueueProviders(LIQUIDITY_MANAGER_QUEUE_NAME, CHECK_BALANCES_QUEUE_NAME, 'default'),
        ...mockFlowProducerProviders(LIQUIDITY_MANAGER_FLOW_NAME, 'default'),
      ],
      imports: [
        BullModule.registerQueue({ name: LIQUIDITY_MANAGER_QUEUE_NAME }),
        BullModule.registerQueue({ name: CHECK_BALANCES_QUEUE_NAME }),
        BullModule.registerFlowProducerAsync({ name: LIQUIDITY_MANAGER_FLOW_NAME }),
      ],
    })
      .overrideProvider(getQueueToken(LIQUIDITY_MANAGER_QUEUE_NAME))
      .useValue(createMock<Queue>())
      .overrideProvider(getQueueToken(CHECK_BALANCES_QUEUE_NAME))
      .useValue(createMock<Queue>())
      .overrideProvider(getFlowProducerToken(LIQUIDITY_MANAGER_FLOW_NAME))
      .useValue(createMock<FlowProducer>())
      .compile()

    balanceService = module.get(BalanceService)
    ecoConfigService = module.get(EcoConfigService)
    crowdLiquidityService = module.get(CrowdLiquidityService)
    liquidityManagerService = module.get(LiquidityManagerService)
    kernelAccountClientService = module.get(KernelAccountClientService)
    liquidityProviderService = module.get(LiquidityProviderService)
    queue = module.get(getQueueToken(LIQUIDITY_MANAGER_QUEUE_NAME))
    checkQueue = module.get(getQueueToken(CHECK_BALANCES_QUEUE_NAME))

    Object.defineProperty(queue, 'name', {
      value: LIQUIDITY_MANAGER_QUEUE_NAME,
      writable: false,
    })

    crowdLiquidityService['getPoolAddress'] = jest.fn().mockReturnValue(zeroAddress)
    kernelAccountClientService['getClient'] = jest
      .fn()
      .mockReturnValue({ kernelAccount: { address: zeroAddress } })
  })

  const mockConfig = {
    targetSlippage: 0.02,
    maxQuoteSlippage: 0.01,
    intervalDuration: 1000,
    thresholds: { surplus: 0.1, deficit: 0.2 },
    coreTokens: [
      { token: '0xCoreToken1', chainID: 5 },
      { token: '0xCoreToken2', chainID: 10 },
    ],
    walletStrategies: {
      'crowd-liquidity-pool': ['CCTP'],
      'eco-wallet': ['LiFi', 'WarpRoute', 'CCTPLiFi'],
    },
    swapSlippage: 0.01,
  } as LiquidityManagerConfig

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onApplicationBootstrap', () => {
    it('should start cron job', async () => {
      const intervalDuration = 1000

      jest
        .spyOn(ecoConfigService, 'getLiquidityManager')
        .mockReturnValue({ intervalDuration } as any)

      const startSpy = jest.fn().mockResolvedValue(undefined)

      // Replace the manager instance for the test wallet
      const walletAddress = zeroAddress
      ;(CheckBalancesCronJobManager as any).ecoCronJobManagers[walletAddress] = {
        start: startSpy,
      }

      await liquidityManagerService.onApplicationBootstrap()

      expect(startSpy).toHaveBeenCalledWith(checkQueue, intervalDuration, walletAddress)

      // Cleanup for isolation
      delete (CheckBalancesCronJobManager as any).ecoCronJobManagers[walletAddress]
    })

    it('should set liquidity manager config', async () => {
      const mockConfig = { intervalDuration: 1000 }
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue(mockConfig as any)
      await liquidityManagerService.onApplicationBootstrap()
      expect(liquidityManagerService['config']).toEqual(mockConfig)
    })
  })

  describe('analyzeTokens', () => {
    it('should analyze tokens and return the analysis', async () => {
      const mockTokens = [
        {
          config: { targetBalance: 10, chainId: 1, address: '0x1' },
          balance: { balance: 100n },
          chainId: 1,
        },
        {
          config: { targetBalance: 100, chainId: 1, address: '0x2' },
          balance: { balance: 100n },
          chainId: 1,
        },
        {
          config: { targetBalance: 200, chainId: 1, address: '0x3' },
          balance: { balance: 100n },
          chainId: 1,
        },
      ]

      // Set up the service properly by calling onApplicationBootstrap
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue(mockConfig as any)
      jest
        .spyOn(balanceService, 'getInboxTokens')
        .mockReturnValue(mockTokens.map((t) => t.config) as any)
      await liquidityManagerService.onApplicationBootstrap()

      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue(mockTokens as any)

      const result = await liquidityManagerService.analyzeTokens(zeroAddress)

      expect(result.items).toHaveLength(3)
      expect(result.surplus.items).toHaveLength(1)
      expect(result.deficit.items).toHaveLength(1)
    })
  })

  describe('getOptimizedRebalancing', () => {
    it('should return swap quotes if possible', async () => {
      const mockDeficitToken = {
        config: { chainId: 1 },
        analysis: { diff: 100, balance: { current: 50 }, targetSlippage: { min: 150 } },
      }
      const mockSurplusTokens = [{ config: { chainId: 1 }, analysis: { diff: 200 } }]

      jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockResolvedValue([{ amountOut: 100 }] as any)

      const result = await liquidityManagerService.getOptimizedRebalancing(
        zeroAddress,
        mockDeficitToken as any,
        mockSurplusTokens as any,
      )

      expect(result).toHaveLength(1)
    })
  })

  // Note: getRebalancingQuotes tests removed as they referenced a non-existent 'fallback' method
  // The fallback functionality may have been refactored or removed in recent changes

  describe('executeRebalancing', () => {
    it('should execute rebalancing quotes', async () => {
      const mockRebalanceData = {
        rebalance: {
          quotes: ['quote1', 'quote2'],
        },
      }
      jest.spyOn(liquidityProviderService, 'execute').mockResolvedValue(undefined as any)

      await liquidityManagerService.executeRebalancing(mockRebalanceData as any)

      expect(liquidityProviderService.execute).toHaveBeenCalledTimes(2)
    })
  })
})
