import { FlowProducer, Queue } from 'bullmq'
import { Model } from 'mongoose'
import { getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import { BullModule, getFlowProducerToken, getQueueToken } from '@nestjs/bullmq'
import { zeroAddress } from 'viem'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CheckBalancesQueue } from '@/liquidity-manager/queues/check-balances.queue'
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
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'

describe('LiquidityManagerService', () => {
  let liquidityManagerService: LiquidityManagerService
  let liquidityProviderService: LiquidityProviderService
  let crowdLiquidityService: CrowdLiquidityService
  let kernelAccountClientService: LmTxGatedKernelAccountClientService
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
          provide: LmTxGatedKernelAccountClientService,
          useValue: createMock<LmTxGatedKernelAccountClientService>(),
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
      ],
      imports: [
        BullModule.registerQueue({ name: LiquidityManagerQueue.queueName }),
        BullModule.registerQueue({ name: CheckBalancesQueue.queueName }),
        BullModule.registerFlowProducerAsync({ name: LiquidityManagerQueue.flowName }),
      ],
    })
      .overrideProvider(getQueueToken(LiquidityManagerQueue.queueName))
      .useValue(createMock<Queue>())
      .overrideProvider(getQueueToken(CheckBalancesQueue.queueName))
      .useValue(createMock<Queue>())
      .overrideProvider(getFlowProducerToken(LiquidityManagerQueue.flowName))
      .useValue(createMock<FlowProducer>())
      .compile()

    balanceService = chainMod.get(BalanceService)
    ecoConfigService = chainMod.get(EcoConfigService)
    crowdLiquidityService = chainMod.get(CrowdLiquidityService)
    liquidityManagerService = chainMod.get(LiquidityManagerService)
    kernelAccountClientService = chainMod.get(LmTxGatedKernelAccountClientService)
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
    minTradeBase6: 0,
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
      const mockConfig = { intervalDuration: 1000, enabled: false }
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
        { config: { targetBalance: 10 }, balance: { balance: 100n } },
        { config: { targetBalance: 100 }, balance: { balance: 100n } },
        { config: { targetBalance: 200 }, balance: { balance: 100n } },
      ]

      liquidityManagerService['config'] = mockConfig

      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue(mockTokens as any)

      const result = await liquidityManagerService.analyzeTokens(zeroAddress)

      expect(result.items).toHaveLength(3)
      expect(result.surplus.items).toHaveLength(1)
      expect(result.deficit.items).toHaveLength(1)
    })

    it('should subtract reserved (pending) amountIn before classification (reservation-aware)', async () => {
      const wallet = zeroAddress

      // Configure thresholds for easy math: targetBalance=100, up=10%, down=20% → min=80, max=110
      liquidityManagerService['config'] = mockConfig

      const usdcOP = {
        chainId: 10,
        config: {
          chainId: 10,
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          targetBalance: 100,
        },
        balance: {
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          decimals: 6,
          balance: 200_000_000n,
        },
      }
      const tokenB = {
        chainId: 8453,
        config: {
          chainId: 8453,
          address: '0x4200000000000000000000000000000000000006',
          targetBalance: 50,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000006',
          decimals: 6,
          balance: 50_000_000n,
        },
      }

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
        config: { chainId: 10, address: '0xToken', targetBalance: 100 },
        balance: { address: '0xToken', decimals: 6, balance: 120_000_000n },
      }

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
        config: { chainId: 10, address: '0xTokenT', targetBalance: 100 },
        balance: { address: '0xTokenT', decimals: 6, balance: 105_000_000n },
      }
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
        config: { chainId: 10, address: '0xNeg', targetBalance: 100 },
        balance: { address: '0xNeg', decimals: 6, balance: 50_000_000n },
      }
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
        config: { chainId: 1, address: '0x18dec', targetBalance: 1 },
        balance: { address: '0x18dec', decimals: 18, balance: 2_000_000_000_000_000_000n }, // 2.0
      }
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
        config: { chainId: 10, address: '0xIdem', targetBalance: 100 },
        balance: { address: '0xIdem', decimals: 6, balance: 200_000_000n },
      })

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
        config: { chainId: 10, address: '0xPresent', targetBalance: 100 },
        balance: { address: '0xPresent', decimals: 6, balance: 100_000_000n },
      }
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
        config: { chainId: 10, address: addr, targetBalance: 100 },
        balance: { address: addr, decimals: 6, balance: 200_000_000n },
      }
      const tokenChain8453 = {
        chainId: 8453,
        config: { chainId: 8453, address: addr, targetBalance: 100 },
        balance: { address: addr, decimals: 6, balance: 200_000_000n },
      }

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
        config: { chainId: 42161, address: '0xOut', targetBalance: 50 },
        balance: { address: '0xOut', decimals: 6, balance: 37_284_271n },
      }
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
        chainId: 1,
        config: { chainId: 1, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: { diff: 100, balance: { current: 50n }, targetSlippage: { min: 150n } },
      }
      const mockSurplusTokens = [
        {
          chainId: 1,
          config: { chainId: 1, address: '0xSurplus' },
          balance: { decimals: 6 },
          analysis: { diff: 200 },
        },
      ]

      // Ensure config is set for method under test
      liquidityManagerService['config'] = mockConfig

      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountOut: 100n,
          amountIn: 100n,
          tokenIn: mockSurplusTokens[0],
          tokenOut: mockDeficitToken,
        },
      ] as any)

      const result = await liquidityManagerService.getOptimizedRebalancing(
        zeroAddress,
        mockDeficitToken as any,
        mockSurplusTokens as any,
      )

      expect(result).toHaveLength(1)
    })

    it('does not attempt cross-chain when same-chain reaches target', async () => {
      const mockDeficitToken = {
        chainId: 1,
        config: { chainId: 1, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: { diff: 100, balance: { current: 50n }, targetSlippage: { min: 150n } },
      }
      const same = {
        chainId: 1,
        config: { chainId: 1, address: '0xSame' },
        balance: { decimals: 6 },
        analysis: { diff: 1_000 },
      }
      const cross = {
        chainId: 10,
        config: { chainId: 10, address: '0xCross' },
        balance: { decimals: 6 },
        analysis: { diff: 1_000 },
      }

      liquidityManagerService['config'] = { ...mockConfig }

      jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockImplementation((walletAddress: string, tokenIn: any, tokenOut: any) => {
          if (tokenIn.config.address === '0xSame') {
            return Promise.resolve([{ amountIn: 100n, amountOut: 100n, tokenIn, tokenOut }] as any)
          }
          // should not be called for cross
          return Promise.reject(new Error('should not reach cross-chain'))
        })

      const result = await liquidityManagerService.getOptimizedRebalancing(
        zeroAddress,
        mockDeficitToken as any,
        [same, cross] as any,
      )

      expect(result).toHaveLength(1)
      expect(liquidityProviderService.getQuote).toHaveBeenCalledTimes(1)
      expect((liquidityProviderService.getQuote as any).mock.calls[0][1].config.address).toBe(
        '0xSame',
      )
    })

    it('accumulates same-chain then cross-chain remainder with correct swapAmount', async () => {
      // target 200, current 50, same-chain gives 120 → remaining 30 for cross-chain
      const mockDeficitToken = {
        chainId: 1,
        config: { chainId: 1, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          diff: 150,
          balance: { current: 50_000_000n },
          targetSlippage: { min: 200_000_000n },
        },
      }
      const same = {
        chainId: 1,
        config: { chainId: 1, address: '0xSame' },
        balance: { decimals: 6 },
        analysis: { diff: 1_000 },
      }
      const cross = {
        chainId: 10,
        config: { chainId: 10, address: '0xCross' },
        balance: { decimals: 6 },
        analysis: { diff: 1_000 },
      }

      liquidityManagerService['config'] = { ...mockConfig }

      jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockImplementation(
          (walletAddress: string, tokenIn: any, tokenOut: any, swapAmount: number) => {
            if (tokenIn.config.address === '0xSame') {
              // first call uses remainingTokens ≈ 150
              expect(Math.round(swapAmount)).toBe(150)
              return Promise.resolve([
                { amountIn: 120_000_000n, amountOut: 120_000_000n, tokenIn, tokenOut },
              ] as any)
            }
            // second call must reflect the remainder ≈ 30
            expect(Math.round(swapAmount)).toBe(30)
            return Promise.resolve([
              { amountIn: 30_000_000n, amountOut: 30_000_000n, tokenIn, tokenOut },
            ] as any)
          },
        )

      const result = await liquidityManagerService.getOptimizedRebalancing(
        zeroAddress,
        mockDeficitToken as any,
        [same, cross] as any,
      )

      expect(result).toHaveLength(2)
      expect(liquidityProviderService.getQuote).toHaveBeenCalledTimes(2)
    })

    it('inspects only deficit-crediting legs when deciding to continue with cross-chain phase', async () => {
      const deficitToken = {
        chainId: 1,
        config: { chainId: 1, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          diff: 100,
          balance: { current: 50_000_000n },
          targetSlippage: { min: 150_000_000n },
        },
      }
      const sameChainSurplus = {
        chainId: 1,
        config: { chainId: 1, address: '0xSame' },
        balance: { decimals: 6 },
        analysis: { diff: 200 },
      }
      const crossChainSurplus = {
        chainId: 10,
        config: { chainId: 10, address: '0xCross' },
        balance: { decimals: 6 },
        analysis: { diff: 200 },
      }

      liquidityManagerService['config'] = { ...mockConfig }

      const quoteSpy = jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockImplementation(
          (walletAddress: string, tokenIn: any, tokenOut: any, swapAmount: number) => {
            if (tokenIn.config.address === '0xSame') {
              return Promise.resolve([
                {
                  amountIn: 80_000_000n,
                  amountOut: 80_000_000n,
                  tokenIn,
                  tokenOut: { chainId: 1, config: { address: '0xIntermediate' } },
                },
                {
                  amountIn: 80_000_000n,
                  amountOut: 60_000_000n,
                  tokenIn: { chainId: 1, config: { address: '0xIntermediate' } },
                  tokenOut: deficitToken,
                },
              ] as any)
            }

            expect(Math.round(swapAmount)).toBeCloseTo(40)
            return Promise.resolve([
              {
                amountIn: 40_000_000n,
                amountOut: 40_000_000n,
                tokenIn,
                tokenOut,
              },
            ] as any)
          },
        )

      const result = await liquidityManagerService.getOptimizedRebalancing(
        zeroAddress,
        deficitToken as any,
        [sameChainSurplus, crossChainSurplus] as any,
      )

      expect(quoteSpy).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(3)
      expect(result[result.length - 1].tokenOut.config.address).toBe('0xDeficit')
    })

    it('attempts cross-chain when same-chain quotes are skipped by the global dust threshold', async () => {
      const deficitToken = {
        chainId: 1,
        config: { chainId: 1, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          diff: 50,
          balance: { current: 100_000_000n },
          targetSlippage: { min: 150_000_000n },
        },
      }
      const tinySameChain = {
        chainId: 1,
        config: { chainId: 1, address: '0xDust' },
        balance: { decimals: 6 },
        analysis: { diff: 0.4 },
      }
      const crossChain = {
        chainId: 10,
        config: { chainId: 10, address: '0xCross' },
        balance: { decimals: 6 },
        analysis: { diff: 100 },
      }

      liquidityManagerService['config'] = { ...mockConfig, minTradeBase6: 1_000_000 }

      const quoteSpy = jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: 50_000_000n,
          amountOut: 50_000_000n,
          tokenIn: crossChain,
          tokenOut: deficitToken,
        },
      ] as any)

      const result = await liquidityManagerService.getOptimizedRebalancing(
        zeroAddress,
        deficitToken as any,
        [tinySameChain, crossChain] as any,
      )

      expect(quoteSpy).toHaveBeenCalledTimes(1)
      expect(quoteSpy.mock.calls[0][1].config.address).toBe('0xCross')
      expect(result).toHaveLength(1)
      expect(result[0].tokenIn.config.address).toBe('0xCross')
    })
  })

  describe('getRebalancingQuotes', () => {
    it('should continue trying other surpluses when one direct route fails (no fallback)', async () => {
      // Mock tokens
      const mockDeficitToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          diff: 100,
          balance: { current: 50n },
          targetSlippage: { min: 150n },
        },
      }
      const mockSurplusTokens = [
        {
          chainId: 1,
          config: { chainId: 1, address: '0xSurplus1' },
          balance: { decimals: 6 },
          analysis: { diff: 50 },
        },
        {
          chainId: 3,
          config: { chainId: 3, address: '0xSurplus2' },
          balance: { decimals: 6 },
          analysis: { diff: 150 },
        },
      ]

      // Make sure the config is set
      liquidityManagerService['config'] = mockConfig

      // Setup getQuote to fail for the first surplus token but succeed for the second
      jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockImplementation((walletAddress: string, tokenIn: any, tokenOut: any) => {
          if (tokenIn.config.address === '0xSurplus1') {
            return Promise.reject(new Error('Route not found'))
          } else {
            return Promise.resolve([
              {
                amountIn: 100n,
                amountOut: 80n,
                tokenIn,
                tokenOut,
              },
            ] as any)
          }
        })

      // Call the method with wallet address parameter
      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        mockSurplusTokens as any,
      )

      // Verify correct calls were made; fallback not used
      expect(liquidityProviderService.getQuote).toHaveBeenCalledTimes(2)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].amountOut).toEqual(80n)
    })

    it('should stop trying when target balance is reached', async () => {
      // Mock tokens
      const mockDeficitToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          diff: 100,
          balance: { current: 50n },
          targetSlippage: { min: 150n },
        },
      }
      const mockSurplusTokens = [
        {
          chainId: 1,
          config: { chainId: 1, address: '0xSurplus1' },
          balance: { decimals: 6 },
          analysis: { diff: 200 },
        },
      ]

      // Make sure the config is set with the mock core tokens
      liquidityManagerService['config'] = mockConfig

      // Setup getQuote to return a quote that reaches the target
      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: 100n,
          amountOut: 100n, // This will make current balance reach the min
          tokenIn: mockSurplusTokens[0],
          tokenOut: mockDeficitToken,
        },
      ] as any)

      // Call the method with wallet address parameter
      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        mockSurplusTokens as any,
      )

      // Verify only one call was made
      expect(liquidityProviderService.getQuote).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
    })

    it('should ignore intermediate quotes that do not credit the deficit token', async () => {
      const mockDeficitToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          diff: 100,
          balance: { current: 50n },
          targetSlippage: { min: 150n },
        },
      }
      const mockSurplusTokens = [
        {
          chainId: 2,
          config: { chainId: 2, address: '0xSurplus1' },
          balance: { decimals: 6 },
          analysis: { diff: 200 },
        },
      ]

      liquidityManagerService['config'] = mockConfig

      const intermediateToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xIntermediate' },
        balance: { decimals: 6 },
      }

      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: 100n,
          amountOut: 120n,
          tokenIn: mockSurplusTokens[0],
          tokenOut: intermediateToken,
        },
        {
          amountIn: 120n,
          amountOut: 80n,
          tokenIn: intermediateToken,
          tokenOut: mockDeficitToken,
        },
      ] as any)

      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        mockSurplusTokens as any,
      )

      expect(liquidityProviderService.getQuote).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(2)
      expect(result[1].tokenOut.config.address).toEqual('0xDeficit')
    })

    it('attempts cross-chain directly when no same-chain surpluses exist', async () => {
      const mockDeficitToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          diff: 100,
          balance: { current: 50n },
          targetSlippage: { min: 150n },
        },
      }
      const crossSurplus = {
        chainId: 3,
        config: { chainId: 3, address: '0xCross' },
        balance: { decimals: 6 },
        analysis: { diff: 200 },
      }

      liquidityManagerService['config'] = mockConfig
      jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockResolvedValue([
          { amountIn: 120n, amountOut: 120n, tokenIn: crossSurplus, tokenOut: mockDeficitToken },
        ] as any)

      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        [crossSurplus] as any,
      )

      expect(liquidityProviderService.getQuote).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
    })

    it('skips dust trades when minTradeBase6 is set and remaining < threshold', async () => {
      const mockDeficitToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          // current = 100, target = 100.5 → remainingTokens = 0.5 < 1 (threshold)
          diff: 1,
          balance: { current: 100_000_000n },
          targetSlippage: { min: 100_500_000n },
        },
      }
      const surplus = {
        chainId: 2,
        config: { chainId: 2, address: '0xSurplus' },
        balance: { decimals: 6 },
        analysis: { diff: 10 },
      }

      liquidityManagerService['config'] = { ...mockConfig, minTradeBase6: 1_000_000 }
      const spy = jest.spyOn(liquidityProviderService, 'getQuote')

      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        [surplus] as any,
      )

      expect(spy).not.toHaveBeenCalled()
      expect(result).toHaveLength(0)
    })

    it('does not skip dust trades when minTradeBase6 is unset or zero', async () => {
      const mockDeficitToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          // remainingTokens ≈ 0.5, threshold = 0 → should call provider
          diff: 1,
          balance: { current: 100_000_000n },
          targetSlippage: { min: 100_500_000n },
        },
      }
      const surplus = {
        chainId: 2,
        config: { chainId: 2, address: '0xSurplus' },
        balance: { decimals: 6 },
        analysis: { diff: 10 },
      }

      liquidityManagerService['config'] = { ...mockConfig, minTradeBase6: 0 }
      const spy = jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockResolvedValue([
          { amountIn: 500_000n, amountOut: 500_000n, tokenIn: surplus, tokenOut: mockDeficitToken },
        ] as any)

      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        [surplus] as any,
      )

      expect(spy).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
    })

    it('skips zero/negative computed swap and does not call provider', async () => {
      const mockDeficitToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          // remainingTokens positive, but diff = 0 → swapAmount = 0
          diff: 100,
          balance: { current: 100_000_000n },
          targetSlippage: { min: 110_000_000n },
        },
      }
      const surplusZero = {
        chainId: 2,
        config: { chainId: 2, address: '0xZero' },
        balance: { decimals: 6 },
        analysis: { diff: 0 },
      }

      liquidityManagerService['config'] = { ...mockConfig, minTradeBase6: 0 }
      const spy = jest.spyOn(liquidityProviderService, 'getQuote')

      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        [surplusZero] as any,
      )

      expect(spy).not.toHaveBeenCalled()
      expect(result).toHaveLength(0)
    })

    it('progressive fill when total surplus is less than deficit', async () => {
      // need 100 tokens (from 50 → 150), but only 70 available total (30 + 40)
      const mockDeficitToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          diff: 100,
          balance: { current: 50_000_000n },
          targetSlippage: { min: 150_000_000n },
        },
      }
      const s1 = {
        chainId: 2,
        config: { chainId: 2, address: '0xS1' },
        balance: { decimals: 6 },
        analysis: { diff: 30 },
      }
      const s2 = {
        chainId: 2,
        config: { chainId: 2, address: '0xS2' },
        balance: { decimals: 6 },
        analysis: { diff: 40 },
      }

      liquidityManagerService['config'] = { ...mockConfig, minTradeBase6: 0 }
      jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockImplementation(
          (walletAddress: string, tokenIn: any, tokenOut: any, swapAmount: number) => {
            const out = Math.min(swapAmount, tokenIn.analysis.diff)
            return Promise.resolve([
              {
                amountIn: BigInt(out * 1_000_000),
                amountOut: BigInt(out * 1_000_000),
                tokenIn,
                tokenOut,
              },
            ] as any)
          },
        )

      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        [s1, s2] as any,
      )

      expect(liquidityProviderService.getQuote).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
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

  describe('startRebalancing', () => {
    it('no-ops when rebalances array is empty', async () => {
      const queueAddSpy = jest.spyOn(
        (liquidityManagerService as any).liquidityManagerFlowProducer,
        'add',
      )
      const res = liquidityManagerService.startRebalancing(zeroAddress, [])
      expect(res).toBeUndefined()
      expect(queueAddSpy).not.toHaveBeenCalled()
    })

    it('enqueues a flow with children when there are rebalances', async () => {
      const queueAddSpy = jest
        .spyOn((liquidityManagerService as any).liquidityManagerFlowProducer, 'add')
        .mockResolvedValue(undefined as any)

      const quotes = [
        {
          amountIn: 1n,
          amountOut: 1n,
          slippage: 0.001,
          tokenIn: {
            chainId: 1,
            config: { chainId: 1, address: '0xIn' },
            balance: { decimals: 6 },
          },
          tokenOut: {
            chainId: 1,
            config: { chainId: 1, address: '0xOut' },
            balance: { decimals: 6 },
          },
          strategy: 'LiFi' as const,
          context: {},
        },
      ]
      const rebalances = [{ token: quotes[0].tokenOut, quotes }]

      const res = liquidityManagerService.startRebalancing(zeroAddress, rebalances as any)
      await res

      expect(queueAddSpy).toHaveBeenCalledTimes(1)
      const arg = (queueAddSpy as any).mock.calls[0][0]
      expect(arg.name).toBe('rebalance-batch')
      expect(Array.isArray(arg.children)).toBe(true)
      expect(arg.children.length).toBe(1)
    })
  })

  describe('storeRebalancing', () => {
    it('stores only valid quotes and skips invalid (amountIn/amountOut <= 0)', async () => {
      // Arrange
      rebalanceRepository.create = jest.fn().mockResolvedValue(undefined)

      const token = {
        chainId: 1,
        config: { chainId: 1, address: '0xOut' },
        balance: { decimals: 6 },
      }
      const quotes = [
        // invalid: amountIn = 0n
        {
          amountIn: 0n,
          amountOut: 10n,
          slippage: 0.001,
          tokenIn: token,
          tokenOut: token,
          strategy: 'LiFi' as const,
          context: {},
        },
        // invalid: amountOut = 0n
        {
          amountIn: 1n,
          amountOut: 0n,
          slippage: 0.001,
          tokenIn: token,
          tokenOut: token,
          strategy: 'LiFi' as const,
          context: {},
        },
        // valid
        {
          amountIn: 2n,
          amountOut: 3n,
          slippage: 0.001,
          tokenIn: token,
          tokenOut: token,
          strategy: 'LiFi' as const,
          context: {},
        },
      ]

      // Act
      await liquidityManagerService.storeRebalancing('0xWallet', { token, quotes } as any)

      // Assert
      expect(rebalanceRepository.create).toHaveBeenCalledTimes(1)
      const call = (rebalanceRepository.create as any).mock.calls[0][0]
      expect(call.amountIn).toBe(2n)
      expect(call.amountOut).toBe(3n)
    })
  })

  describe('executeRebalancing (error path)', () => {
    it('throws when any quote execution fails', async () => {
      const mockRebalanceData = {
        rebalance: {
          quotes: ['quote1', 'quote2'],
        },
        walletAddress: '0xWallet',
      }

      const exec = jest
        .spyOn(liquidityProviderService, 'execute')
        .mockResolvedValueOnce(undefined as any)
        .mockRejectedValueOnce(new Error('exec failed'))

      await expect(
        liquidityManagerService.executeRebalancing(mockRebalanceData as any),
      ).rejects.toThrow('exec failed')

      expect(exec).toHaveBeenCalledTimes(2)
    })
  })
})
