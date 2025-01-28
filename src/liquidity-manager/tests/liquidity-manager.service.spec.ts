import { FlowProducer, Queue } from 'bullmq'
import { Model } from 'mongoose'
import { getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { BullModule, getFlowProducerToken, getQueueToken } from '@nestjs/bullmq'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'

describe('LiquidityManagerService', () => {
  let liquidityManagerService: LiquidityManagerService
  let liquidityProviderService: LiquidityProviderService
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityManagerService,
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: LiquidityProviderService, useValue: createMock<LiquidityProviderService>() },
        {
          provide: getModelToken(RebalanceModel.name),
          useValue: createMock<Model<RebalanceModel>>(),
        },
      ],
      imports: [
        BullModule.registerQueue({ name: LiquidityManagerQueue.queueName }),
        BullModule.registerFlowProducerAsync({ name: LiquidityManagerQueue.flowName }),
      ],
    })
      .overrideProvider(getQueueToken(LiquidityManagerQueue.queueName))
      .useValue(createMock<Queue>())
      .overrideProvider(getFlowProducerToken(LiquidityManagerQueue.flowName))
      .useValue(createMock<FlowProducer>())
      .compile()

    balanceService = chainMod.get(BalanceService)
    ecoConfigService = chainMod.get(EcoConfigService)
    liquidityManagerService = chainMod.get(LiquidityManagerService)
    liquidityProviderService = chainMod.get(LiquidityProviderService)
    queue = chainMod.get(getQueueToken(LiquidityManagerQueue.queueName))
  })

  const mockConfig = {
    targetSlippage: 0.02,
    intervalDuration: 1000,
    thresholds: { surplus: 0.1, deficit: 0.2 },
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onApplicationBootstrap', () => {
    it('should start cron job', async () => {
      const intervalDuration = 1000
      jest
        .spyOn(ecoConfigService, 'getLiquidityManager')
        .mockReturnValue({ intervalDuration } as any)

      await liquidityManagerService.onApplicationBootstrap()

      const upsertJobScheduler = jest.spyOn(queue, 'upsertJobScheduler')
      expect(upsertJobScheduler).toHaveBeenCalledWith(
        CheckBalancesCronJobManager.jobSchedulerName,
        { every: intervalDuration },
        expect.anything(),
      )
    })

    it('should set liquidity manager config', async () => {
      const mockConfig = { test: 1000n }
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue(mockConfig as any)
      await liquidityManagerService.onApplicationBootstrap()
      expect(liquidityManagerService['config']).toEqual(mockConfig)
    })
  })

  describe('analyzeTokens', () => {
    it('should analyze tokens and return the analysis', async () => {
      const mockTokens = [
        { config: { targetBalance: 10 }, balance: { balance: 100n } },
        { config: { targetBalance: 100 }, balance: { balance: 100n } },
        { config: { targetBalance: 200 }, balance: { balance: 100n } },
      ]

      liquidityManagerService['config'] = mockConfig

      jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue(mockTokens as any)

      const result = await liquidityManagerService.analyzeTokens()

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
        mockDeficitToken as any,
        mockSurplusTokens as any,
      )

      expect(result).toHaveLength(1)
    })
  })

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
