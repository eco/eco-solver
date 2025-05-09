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
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { WrappedTokenService } from '@/liquidity-manager/services/wrapped-token.service'

describe('LiquidityManagerService', () => {
  let liquidityManagerService: LiquidityManagerService
  let liquidityProviderService: LiquidityProviderService
  let crowdLiquidityService: CrowdLiquidityService
  let kernelAccountClientService: KernelAccountClientService
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let wrappedTokenService: DeepMocked<WrappedTokenService>
  let queue: DeepMocked<Queue>

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityManagerService,
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: LiquidityProviderService, useValue: createMock<LiquidityProviderService>() },
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
        { provide: CrowdLiquidityService, useValue: createMock<CrowdLiquidityService>() },
        { provide: WrappedTokenService, useValue: createMock<WrappedTokenService>() },
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
    crowdLiquidityService = chainMod.get(CrowdLiquidityService)
    liquidityManagerService = chainMod.get(LiquidityManagerService)
    kernelAccountClientService = chainMod.get(KernelAccountClientService)
    liquidityProviderService = chainMod.get(LiquidityProviderService)
    wrappedTokenService = chainMod.get(WrappedTokenService)
    queue = chainMod.get(getQueueToken(LiquidityManagerQueue.queueName))

    crowdLiquidityService['getPoolAddress'] = jest.fn().mockReturnValue(zeroAddress)
    kernelAccountClientService['getClient'] = jest
      .fn()
      .mockReturnValue({ kernelAccount: { address: zeroAddress } })
  })

  const mockConfig = {
    targetSlippage: 0.02,
    intervalDuration: 1000,
    thresholds: { surplus: 0.1, deficit: 0.2 },
    coreTokens: [
      { token: '0xCoreToken1', chainID: 5 },
      { token: '0xCoreToken2', chainID: 10 },
    ],
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

      await liquidityManagerService.onApplicationBootstrap()

      const upsertJobScheduler = jest.spyOn(queue, 'upsertJobScheduler')
      expect(upsertJobScheduler).toHaveBeenCalledWith(
        CheckBalancesCronJobManager.getJobSchedulerName(zeroAddress),
        { every: intervalDuration },
        expect.anything(),
      )
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
      jest.spyOn(liquidityProviderService, 'fallback').mockResolvedValue({
        amountIn: 50n,
        amountOut: 40n,
      } as any)

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

      // Verify the result includes both quotes
      expect(result).toHaveLength(2)
      expect(result[0].amountOut).toEqual(80n) // from getQuote for second token
      expect(result[1].amountOut).toEqual(40n) // from fallback for first token
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

  describe('getWETHRebalances', () => {
    it('should delegate to the WrappedTokenService', async () => {
      const walletAddress = '0xWalletAddress'
      const mockRebalanceRequests = [{ token: { chainId: 1 }, quotes: [] }]

      // Mock wrapped token service response
      wrappedTokenService.getWrappedTokenRebalances = jest
        .fn()
        .mockResolvedValue(mockRebalanceRequests)

      const result = await liquidityManagerService.getWETHRebalances(walletAddress)

      expect(result).toEqual(mockRebalanceRequests)
      expect(wrappedTokenService.getWrappedTokenRebalances).toHaveBeenCalledWith(walletAddress)
    })

    it('should handle errors from WrappedTokenService', async () => {
      const walletAddress = '0xWalletAddress'

      // Mock wrapped token service to throw an error
      wrappedTokenService.getWrappedTokenRebalances = jest
        .fn()
        .mockRejectedValue(new Error('Test error'))

      const result = await liquidityManagerService.getWETHRebalances(walletAddress)

      // Should return empty array on error
      expect(result).toEqual([])
      expect(wrappedTokenService.getWrappedTokenRebalances).toHaveBeenCalledWith(walletAddress)
    })
  })
})
