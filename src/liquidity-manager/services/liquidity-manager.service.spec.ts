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
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { EverclearProviderService } from './liquidity-providers/Everclear/everclear-provider.service'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { TokenState } from '@/liquidity-manager/types/token-state.enum'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'

describe('LiquidityManagerService', () => {
  let liquidityManagerService: LiquidityManagerService
  let liquidityProviderService: LiquidityProviderService
  let crowdLiquidityService: CrowdLiquidityService
  let kernelAccountClientService: KernelAccountClientService
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>
  let rebalanceModel: DeepMocked<Model<RebalanceModel>>
  let rebalanceRepository: jest.Mocked<RebalanceRepository>

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
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
          provide: getModelToken(RebalanceModel.name),
          useValue: createMock<Model<RebalanceModel>>(),
        },
        { provide: EverclearProviderService, useValue: createMock<EverclearProviderService>() },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
        {
          provide: RebalanceRepository,
          useValue: {
            getPendingReservedByTokenForWallet: jest.fn(),
            getPendingIncomingByTokenForWallet: jest.fn(),
          },
        },
        // mock queue/flow providers to satisfy Nest DI in tests (also include the unnamed/default token)
        ...mockQueueProviders(LIQUIDITY_MANAGER_QUEUE_NAME, CHECK_BALANCES_QUEUE_NAME, 'default'),
        ...mockFlowProducerProviders(LIQUIDITY_MANAGER_FLOW_NAME, 'default'),
      ],
      imports: [
        BullModule.registerQueue({ name: LIQUIDITY_MANAGER_QUEUE_NAME }),
        BullModule.registerQueue({ name: CHECK_BALANCES_QUEUE_NAME }),
        BullModule.registerFlowProducerAsync({ name: LIQUIDITY_MANAGER_FLOW_NAME }),
      ],
    })
      // keep existing explicit overrides in case other tests rely on ts-jest mocks
      .overrideProvider(getQueueToken(LIQUIDITY_MANAGER_QUEUE_NAME))
      .useValue(createMock<Queue>())
      .overrideProvider(getQueueToken(CHECK_BALANCES_QUEUE_NAME))
      .useValue(createMock<Queue>())
      .overrideProvider(getFlowProducerToken(LIQUIDITY_MANAGER_FLOW_NAME))
      .useValue(createMock<FlowProducer>())
      .compile()

    balanceService = chainMod.get(BalanceService)
    ecoConfigService = chainMod.get(EcoConfigService)
    crowdLiquidityService = chainMod.get(CrowdLiquidityService)
    liquidityManagerService = chainMod.get(LiquidityManagerService)
    kernelAccountClientService = chainMod.get(KernelAccountClientService)
    liquidityProviderService = chainMod.get(LiquidityProviderService)
    queue = chainMod.get(getQueueToken(LiquidityManagerQueue.queueName))
    rebalanceModel = chainMod.get(getModelToken(RebalanceModel.name)) as any
    rebalanceRepository = chainMod.get(RebalanceRepository) as any

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
    it('should set liquidity manager config', async () => {
      const mockConfig = { intervalDuration: 1000 }
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue(mockConfig as any)
      await liquidityManagerService.onApplicationBootstrap()
      expect(liquidityManagerService['config']).toEqual(mockConfig)
    })

    it('cleans schedulers on legacy and dedicated queues and schedules kernel', async () => {
      const mockConfig = { intervalDuration: 1000 }
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue(mockConfig as any)

      const removeSpy = jest
        .spyOn(require('@/bullmq/utils/queue'), 'removeJobSchedulers')
        .mockResolvedValue(undefined as any)

      const startSpy = jest
        .spyOn(CheckBalancesCronJobManager, 'start')
        .mockResolvedValue(undefined as any)

      await liquidityManagerService.onApplicationBootstrap()

      expect(removeSpy).toHaveBeenCalled()
      expect(startSpy).toHaveBeenCalled()
    })
  })

  describe('analyzeTokens', () => {
    it('should analyze tokens and return the analysis', async () => {
      const mockTokens = [
        // Token with surplus: target 10, actual ~20 (with thresholds: surplus at +10% = 11)
        {
          config: {
            targetBalance: 10,
            chainId: 1,
            address: '0x1' as any,
            minBalance: 0,
            type: 'erc20' as any,
          },
          balance: { address: '0x1' as any, balance: 20000000000000000000n, decimals: 18 },
          chainId: 1,
        },
        // Token with deficit: target 100, actual ~50 (with thresholds: deficit at -20% = 80)
        {
          config: {
            targetBalance: 100,
            chainId: 1,
            address: '0x2' as any,
            minBalance: 0,
            type: 'erc20' as any,
          },
          balance: { address: '0x2' as any, balance: 50000000000000000000n, decimals: 18 },
          chainId: 1,
        },
        // Token with deficit: target 200, actual ~100 (with thresholds: deficit at -20% = 160)
        {
          config: {
            targetBalance: 200,
            chainId: 1,
            address: '0x3' as any,
            minBalance: 0,
            type: 'erc20' as any,
          },
          balance: { address: '0x3' as any, balance: 100000000000000000000n, decimals: 18 },
          chainId: 1,
        },
      ]

      // Set up the service properly by calling onApplicationBootstrap
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue(mockConfig as any)
      jest
        .spyOn(balanceService, 'getInboxTokens')
        .mockReturnValue(mockTokens.map((t) => t.config) as any)
      await liquidityManagerService.onApplicationBootstrap()

      // Mock repository methods to return empty maps
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(new Map())
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue(mockTokens as any)

      const result = await liquidityManagerService.analyzeTokens(zeroAddress)

      expect(result.items).toHaveLength(3)
      expect(result.surplus.items).toHaveLength(1)
      expect(result.deficit.items).toHaveLength(2)
    })

    it('should subtract reserved (pending) amountIn before classification (reservation-aware)', async () => {
      const wallet = zeroAddress

      // Configure thresholds for easy math: targetBalance=100, up=10%, down=20% → min=80, max=110
      liquidityManagerService['config'] = mockConfig

      const usdcOP = {
        chainId: 10,
        config: {
          chainId: 10,
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as any,
          targetBalance: 100,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: {
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as any,
          decimals: 6,
          balance: 200_000_000n,
        },
      }
      const tokenB = {
        chainId: 8453,
        config: {
          chainId: 8453,
          address: '0x4200000000000000000000000000000000000006' as any,
          targetBalance: 50,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000006' as any,
          decimals: 6,
          balance: 50_000_000n,
        },
      }

      // Set up tokensPerWallet to include the wallet
      liquidityManagerService['tokensPerWallet'][wallet] = [usdcOP.config, tokenB.config] as any

      jest
        .spyOn(balanceService, 'getAllTokenDataForAddress')
        .mockResolvedValue([usdcOP, tokenB] as any)

      // Mock repository to reserve 120 USDC (6 decimals) on OP for the wallet
      const key = `10:${'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'.toLowerCase()}`
      const reserved = new Map<string, bigint>([[key, 120_000_000n]])
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(reserved)

      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      const result = await liquidityManagerService.analyzeTokens(wallet)

      // usdcOP adjusted current = 200 - 120 = 80 → exactly at min → IN_RANGE
      const adjustedA = result.items.find(
        (t: any) => t.config.address === usdcOP.config.address && t.chainId === 10,
      ) as any
      expect(adjustedA).toBeDefined()
      if (!adjustedA) throw new Error('Adjusted token A not found')
      expect(adjustedA.analysis.balance.current).toEqual(80_000_000n)
      expect(adjustedA.analysis.state).toBe(TokenState.IN_RANGE)

      // tokenB unchanged (no reservation) → target=50, current=50 → IN_RANGE
      const adjustedB = result.items.find(
        (t: any) => t.config.address === tokenB.config.address && t.chainId === 8453,
      ) as any
      expect(adjustedB).toBeDefined()
      if (!adjustedB) throw new Error('Adjusted token B not found')
      expect(adjustedB.analysis.balance.current).toEqual(50_000_000n)
      expect(adjustedB.analysis.state).toBe(TokenState.IN_RANGE)
    })

    it('boundary at maximum: reserved moves current to max → IN_RANGE', async () => {
      const wallet = zeroAddress
      liquidityManagerService['config'] = mockConfig

      // target=100, up=10% → max=110
      const token = {
        chainId: 10,
        config: {
          chainId: 10,
          address: '0xToken' as any,
          targetBalance: 100,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: { address: '0xToken' as any, decimals: 6, balance: 120_000_000n },
      }

      // Set up tokensPerWallet to include the wallet
      liquidityManagerService['tokensPerWallet'][wallet] = [token.config] as any

      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue([token] as any)

      const key = `10:${'0xToken'.toLowerCase()}`
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(
        new Map([[key, 10_000_000n]]),
      )
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      const result = await liquidityManagerService.analyzeTokens(wallet)
      const item = result.items[0]
      expect(item.analysis.balance.current).toEqual(110_000_000n)
      expect(item.analysis.state).toBe(TokenState.IN_RANGE)
    })

    it('boundary at target: reserved moves current to target → IN_RANGE', async () => {
      const wallet = zeroAddress
      liquidityManagerService['config'] = mockConfig

      const token = {
        chainId: 10,
        config: {
          chainId: 10,
          address: '0xTokenT' as any,
          targetBalance: 100,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: { address: '0xTokenT' as any, decimals: 6, balance: 105_000_000n },
      }

      // Set up tokensPerWallet to include the wallet
      liquidityManagerService['tokensPerWallet'][wallet] = [token.config] as any

      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue([token] as any)

      const key = `10:${'0xTokenT'.toLowerCase()}`
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(
        new Map([[key, 5_000_000n]]),
      )
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      const result = await liquidityManagerService.analyzeTokens(wallet)
      const item = result.items[0]
      expect(item.analysis.balance.current).toEqual(100_000_000n)
      expect(item.analysis.state).toBe(TokenState.IN_RANGE)
    })

    it('negative current when reserved > balance → DEFICIT', async () => {
      const wallet = zeroAddress
      liquidityManagerService['config'] = mockConfig

      const token = {
        chainId: 10,
        config: {
          chainId: 10,
          address: '0xNeg' as any,
          targetBalance: 100,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: { address: '0xNeg' as any, decimals: 6, balance: 50_000_000n },
      }

      // Set up tokensPerWallet to include the wallet
      liquidityManagerService['tokensPerWallet'][wallet] = [token.config] as any

      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue([token] as any)

      const key = `10:${'0xNeg'.toLowerCase()}`
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(
        new Map([[key, 60_000_000n]]),
      )
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      const result = await liquidityManagerService.analyzeTokens(wallet)
      const item = result.items[0]
      expect(item.analysis.balance.current).toEqual(-10_000_000n)
      expect(item.analysis.state).toBe(TokenState.DEFICIT)
    })

    it('decimals variance: 18-decimal token subtracts correctly', async () => {
      const wallet = zeroAddress
      liquidityManagerService['config'] = mockConfig

      const token18 = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x18dec' as any,
          targetBalance: 1,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: { address: '0x18dec' as any, decimals: 18, balance: 2_000_000_000_000_000_000n }, // 2.0
      }

      // Set up tokensPerWallet to include the wallet
      liquidityManagerService['tokensPerWallet'][wallet] = [token18.config] as any

      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue([token18] as any)

      const key = `1:${'0x18dec'.toLowerCase()}`
      // reserve 1.2
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(
        new Map([[key, 1_200_000_000_000_000_000n]]),
      )
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      const result = await liquidityManagerService.analyzeTokens(wallet)
      const item = result.items[0]
      expect(item.analysis.balance.current).toEqual(800_000_000_000_000_000n) // 0.8
      expect([TokenState.IN_RANGE, TokenState.DEFICIT]).toContain(item.analysis.state)
    })

    it('idempotency across calls: no cumulative subtraction when balances re-fetched fresh', async () => {
      const wallet = zeroAddress
      liquidityManagerService['config'] = mockConfig

      const baseTokenFactory = () => ({
        chainId: 10,
        config: {
          chainId: 10,
          address: '0xIdem' as any,
          targetBalance: 100,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: { address: '0xIdem' as any, decimals: 6, balance: 200_000_000n },
      })

      // Set up tokensPerWallet to include the wallet
      liquidityManagerService['tokensPerWallet'][wallet] = [baseTokenFactory().config] as any

      // Return fresh objects each time
      jest
        .spyOn(balanceService, 'getAllTokenDataForAddress')
        .mockResolvedValueOnce([baseTokenFactory()] as any)
        .mockResolvedValueOnce([baseTokenFactory()] as any)

      const key = `10:${'0xIdem'.toLowerCase()}`
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(
        new Map([[key, 120_000_000n]]),
      )
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      const r1 = await liquidityManagerService.analyzeTokens(wallet)
      const c1 = r1.items[0].analysis.balance.current
      const r2 = await liquidityManagerService.analyzeTokens(wallet)
      const c2 = r2.items[0].analysis.balance.current
      expect(c1).toEqual(80_000_000n)
      expect(c2).toEqual(80_000_000n)
    })

    it('unused reservation keys: map includes tokens not present in wallet → ignored', async () => {
      const wallet = zeroAddress
      liquidityManagerService['config'] = mockConfig

      const token = {
        chainId: 10,
        config: {
          chainId: 10,
          address: '0xPresent' as any,
          targetBalance: 100,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: { address: '0xPresent' as any, decimals: 6, balance: 100_000_000n },
      }

      // Set up tokensPerWallet to include the wallet
      liquidityManagerService['tokensPerWallet'][wallet] = [token.config] as any

      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue([token] as any)

      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(
        new Map([
          [`10:${'0xAbsent'.toLowerCase()}`, 50_000_000n],
          [`8453:${'0xElse'.toLowerCase()}`, 1_000_000n],
        ]),
      )
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      const result = await liquidityManagerService.analyzeTokens(wallet)
      const item = result.items[0]
      expect(item.analysis.balance.current).toEqual(100_000_000n)
    })

    it('cross-chain separation: same address across chains does not cross-subtract', async () => {
      const wallet = zeroAddress
      liquidityManagerService['config'] = mockConfig

      const addr = '0xSame'
      const tokenChain10 = {
        chainId: 10,
        config: {
          chainId: 10,
          address: addr as any,
          targetBalance: 100,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: { address: addr as any, decimals: 6, balance: 200_000_000n },
      }
      const tokenChain8453 = {
        chainId: 8453,
        config: {
          chainId: 8453,
          address: addr as any,
          targetBalance: 100,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: { address: addr as any, decimals: 6, balance: 200_000_000n },
      }

      // Set up tokensPerWallet to include the wallet
      liquidityManagerService['tokensPerWallet'][wallet] = [
        tokenChain10.config,
        tokenChain8453.config,
      ] as any

      jest
        .spyOn(balanceService, 'getAllTokenDataForAddress')
        .mockResolvedValue([tokenChain10, tokenChain8453] as any)

      const key10 = `10:${addr.toLowerCase()}`
      const key8453 = `8453:${addr.toLowerCase()}`
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(
        new Map([
          [key10, 120_000_000n],
          [key8453, 50_000_000n],
        ]),
      )
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      const result = await liquidityManagerService.analyzeTokens(wallet)
      const item10 = result.items.find((t: any) => t.chainId === 10)!
      const item8453 = result.items.find((t: any) => t.chainId === 8453)!
      expect(item10.analysis.balance.current).toEqual(80_000_000n) // 200-120
      expect(item8453.analysis.balance.current).toEqual(150_000_000n) // 200-50
    })

    it('empty wallet tokens: when no tokens returned, result is empty and no crash', async () => {
      const wallet = zeroAddress
      liquidityManagerService['config'] = mockConfig
      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue([] as any)
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(new Map())
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(new Map())

      const result = await liquidityManagerService.analyzeTokens(wallet)
      expect(result.items).toHaveLength(0)
      expect(result.surplus.items).toHaveLength(0)
      expect(result.deficit.items).toHaveLength(0)
    })

    it('adds incoming (pending amountOut) before classification', async () => {
      const wallet = zeroAddress
      liquidityManagerService['config'] = mockConfig

      const token = {
        chainId: 42161,
        config: {
          chainId: 42161,
          address: '0xOut' as any,
          targetBalance: 50,
          minBalance: 0,
          type: 'erc20' as any,
        },
        balance: { address: '0xOut' as any, decimals: 6, balance: 37_284_271n },
      }

      // Set up tokensPerWallet to include the wallet
      liquidityManagerService['tokensPerWallet'][wallet] = [token.config] as any

      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue([token] as any)

      const key = `42161:${'0xOut'.toLowerCase()}`
      rebalanceRepository.getPendingReservedByTokenForWallet.mockResolvedValue(new Map())
      rebalanceRepository.getPendingIncomingByTokenForWallet.mockResolvedValue(
        new Map([[key, 12_712_263n]]),
      )

      const result = await liquidityManagerService.analyzeTokens(wallet)
      const item = result.items[0]
      expect(item.analysis.balance.current).toEqual(49_996_534n)
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
