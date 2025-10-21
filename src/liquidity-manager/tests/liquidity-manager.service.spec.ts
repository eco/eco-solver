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
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { EcoAnalyticsService } from '@/analytics'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'

describe('LiquidityManagerService', () => {
  let liquidityManagerService: LiquidityManagerService
  let liquidityProviderService: LiquidityProviderService
  let crowdLiquidityService: CrowdLiquidityService
  let kernelAccountClientService: LmTxGatedKernelAccountClientService
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>
  let checkQueue: DeepMocked<Queue>

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
          provide: EcoAnalyticsService,
          useValue: createMock<EcoAnalyticsService>(),
        },
        {
          provide: RebalanceRepository,
          useValue: { getPendingReservedByTokenForWallet: jest.fn().mockResolvedValue(new Map()) },
        },
        {
          provide: getModelToken(RebalanceModel.name),
          useValue: createMock<Model<RebalanceModel>>(),
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
    checkQueue = chainMod.get(getQueueToken(CheckBalancesQueue.queueName))

    Object.defineProperty(queue, 'name', {
      value: LiquidityManagerQueue.queueName,
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

      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: 100n,
          amountOut: 100n,
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
  })

  describe('getRebalancingQuotes', () => {
    it('continues to other surpluses when a direct route fails (no fallback)', async () => {
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

      liquidityManagerService['config'] = mockConfig

      jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockImplementation((walletAddress: string, tokenIn: any, tokenOut: any) => {
          if (tokenIn.config.address === '0xSurplus1') {
            return Promise.reject(new Error('Route not found'))
          }
          return Promise.resolve([{ amountIn: 100n, amountOut: 80n, tokenIn, tokenOut }] as any)
        })

      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        mockSurplusTokens as any,
      )

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

    it('skips dust-sized same-chain quotes when minTradeBase6 is configured and continues with cross-chain', async () => {
      const mockDeficitToken = {
        chainId: 2,
        config: { chainId: 2, address: '0xDeficit' },
        balance: { decimals: 6 },
        analysis: {
          diff: 30,
          balance: { current: 100_000_000n },
          targetSlippage: { min: 130_000_000n },
        },
      }
      const tinySameChain = {
        chainId: 2,
        config: { chainId: 2, address: '0xDust' },
        balance: { decimals: 6 },
        analysis: { diff: 0.2 },
      }
      const crossChain = {
        chainId: 3,
        config: { chainId: 3, address: '0xCross' },
        balance: { decimals: 6 },
        analysis: { diff: 100 },
      }

      liquidityManagerService['config'] = { ...mockConfig, minTradeBase6: 1_000_000 }

      const quoteSpy = jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: 30_000_000n,
          amountOut: 30_000_000n,
          tokenIn: crossChain,
          tokenOut: mockDeficitToken,
        },
      ] as any)

      const result = await (liquidityManagerService as any).getRebalancingQuotes(
        '0xWalletAddress',
        mockDeficitToken as any,
        [tinySameChain, crossChain] as any,
      )

      expect(quoteSpy).toHaveBeenCalledTimes(1)
      expect(quoteSpy.mock.calls[0][1].config.address).toBe('0xCross')
      expect(result).toHaveLength(1)
    })

    it('returns partial quotes when total surplus is insufficient', async () => {
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
        chainId: 3,
        config: { chainId: 3, address: '0xS2' },
        balance: { decimals: 6 },
        analysis: { diff: 40 },
      }

      liquidityManagerService['config'] = { ...mockConfig, minTradeBase6: 0 }
      jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockImplementation(
          (walletAddress: string, tokenIn: any, tokenOut: any, swapAmount: number) => {
            return Promise.resolve([
              {
                amountIn: BigInt(Math.round(swapAmount * 1_000_000)),
                amountOut: BigInt(Math.round(swapAmount * 1_000_000)),
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
      expect(result.length).toBeGreaterThan(0)
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
