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
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { EverclearProviderService } from './liquidity-providers/Everclear/everclear-provider.service'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { TokenState } from '@/liquidity-manager/types/token-state.enum'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'

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
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
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

  describe('getRebalancingQuotes', () => {
    it('should try fallback routes when direct routes fail', async () => {
      // Mock tokens
      const mockDeficitToken = {
        config: { chainId: 2, address: '0xDeficit' },
        analysis: {
          diff: 100,
          balance: { current: 50n },
          targetSlippage: { min: 150n },
        },
      }
      const mockSurplusTokens = [
        {
          config: { chainId: 1, address: '0xSurplus1' },
          analysis: { diff: 50 },
        },
        {
          config: { chainId: 3, address: '0xSurplus2' },
          analysis: { diff: 150 },
        },
      ]

      // Make sure the config is set with the mock core tokens
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

      // Setup fallback to succeed
      jest.spyOn(liquidityProviderService, 'fallback').mockResolvedValue([
        {
          amountIn: 50n,
          amountOut: 40n,
        },
      ] as any)

      // Call the method with wallet address parameter
      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        mockSurplusTokens as any,
      )

      // Verify correct calls were made
      expect(liquidityProviderService.getQuote).toHaveBeenCalledTimes(2)
      expect(liquidityProviderService.fallback).toHaveBeenCalledTimes(1)
      expect(liquidityProviderService.fallback).toHaveBeenCalledWith(
        mockSurplusTokens[0],
        mockDeficitToken,
        50, // min of deficit diff and surplus diff
      )

      // Verify the result includes only the quote from getQuote
      // Note: There's a bug in the implementation where fallback quotes are not properly added
      expect(result).toHaveLength(2)
      expect(result[0].amountOut).toEqual(80n) // from getQuote for second token
    })

    it('should stop trying when target balance is reached', async () => {
      // Mock tokens
      const mockDeficitToken = {
        config: { chainId: 2, address: '0xDeficit' },
        analysis: {
          diff: 100,
          balance: { current: 50n },
          targetSlippage: { min: 150n },
        },
      }
      const mockSurplusTokens = [
        { config: { chainId: 1, address: '0xSurplus1' }, analysis: { diff: 50 } },
        { config: { chainId: 3, address: '0xSurplus2' }, analysis: { diff: 150 } },
      ]

      // Make sure the config is set with the mock core tokens
      liquidityManagerService['config'] = mockConfig

      // Setup getQuote to return a quote that reaches the target
      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: 100n,
          amountOut: 100n, // This will make current balance reach the min
        },
      ] as any)

      const fallbackSpy = jest.spyOn(liquidityProviderService, 'fallback')

      // Call the method with wallet address parameter
      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        mockSurplusTokens as any,
      )

      // Verify only one call was made and fallback was never called
      expect(liquidityProviderService.getQuote).toHaveBeenCalledTimes(1)
      expect(fallbackSpy).not.toHaveBeenCalled()
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
