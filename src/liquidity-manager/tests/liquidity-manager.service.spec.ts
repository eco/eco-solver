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

describe('LiquidityManagerService', () => {
  let liquidityManagerService: LiquidityManagerService
  let liquidityProviderService: LiquidityProviderService
  let crowdLiquidityService: CrowdLiquidityService
  let kernelAccountClientService: KernelAccountClientService
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
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
        { provide: CrowdLiquidityService, useValue: createMock<CrowdLiquidityService>() },
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
    it('should return empty array when wallet address is not kernel address', async () => {
      const walletAddress = '0xUserWallet'
      
      // Mock getClient to return a different address than the walletAddress
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue({
        kernelAccount: { address: '0xDifferentAddress' }
      })

      const result = await liquidityManagerService.getWETHRebalances(walletAddress)
      
      expect(result).toEqual([])
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(10) // OP chain
    })

    it('should call getWETHRebalance for each chain and return valid results', async () => {
      const kernelAddress = '0xKernelAddress'
      
      // Mock getClient to return the same address as walletAddress
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue({
        kernelAccount: { address: kernelAddress }
      })

      // Setup tokensPerWallet for multiple chains
      liquidityManagerService['tokensPerWallet'] = {
        [kernelAddress]: [
          { chainId: 1, address: '0xToken1' },
          { chainId: 10, address: '0xToken2' },
        ]
      }

      // Mock getWETHRebalance to return rebalance requests
      const rebalanceRequest1 = { token: { chainId: 1 }, quotes: [] }
      const rebalanceRequest2 = { token: { chainId: 10 }, quotes: [] }
      
      // First call returns a rebalance, second returns undefined (no need to rebalance)
      jest.spyOn(liquidityManagerService as any, 'getWETHRebalance')
        .mockImplementation((address, chainId) => {
          if (chainId === 1) return Promise.resolve(rebalanceRequest1)
          if (chainId === 10) return Promise.resolve(rebalanceRequest2)
          return Promise.resolve(undefined)
        })

      const result = await liquidityManagerService.getWETHRebalances(kernelAddress)
      
      expect(result).toEqual([rebalanceRequest1, rebalanceRequest2])
      expect(liquidityManagerService['getWETHRebalance']).toHaveBeenCalledTimes(2)
      expect(liquidityManagerService['getWETHRebalance']).toHaveBeenCalledWith(
        kernelAddress, 1, expect.anything()
      )
      expect(liquidityManagerService['getWETHRebalance']).toHaveBeenCalledWith(
        kernelAddress, 10, expect.anything()
      )
    })

    it('should filter out undefined results from getWETHRebalance', async () => {
      const kernelAddress = '0xKernelAddress'
      
      // Mock getClient to return the same address as walletAddress
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue({
        kernelAccount: { address: kernelAddress }
      })

      // Setup tokensPerWallet for multiple chains
      liquidityManagerService['tokensPerWallet'] = {
        [kernelAddress]: [
          { chainId: 1, address: '0xToken1' },
          { chainId: 10, address: '0xToken2' },
        ]
      }

      // Mock getWETHRebalance to return one rebalance request and one undefined
      const rebalanceRequest = { token: { chainId: 1 }, quotes: [] }
      
      jest.spyOn(liquidityManagerService as any, 'getWETHRebalance')
        .mockImplementation((address, chainId) => {
          if (chainId === 1) return Promise.resolve(rebalanceRequest)
          return Promise.resolve(undefined)
        })

      const result = await liquidityManagerService.getWETHRebalances(kernelAddress)
      
      expect(result).toEqual([rebalanceRequest])
      expect(result.length).toBe(1)
      expect(liquidityManagerService['getWETHRebalance']).toHaveBeenCalledTimes(2)
    })
  })

  describe('getWETHRebalance', () => {
    it('should return undefined when WETH balance is below threshold', async () => {
      const walletAddress = '0xWalletAddress'
      const chainId = 1
      const token = { chainId: 1, address: '0xToken1' }
      
      // Mock client
      const mockClient = {
        readContract: jest.fn().mockResolvedValue(10n) // Low balance
      }
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue(mockClient)
      
      // Mock config
      const mockWETHConfig = {
        addresses: { 1: '0xWETHAddress' },
        threshold: '100' // Higher than current balance
      }
      ecoConfigService.getWETH = jest.fn().mockReturnValue(mockWETHConfig)
      
      const result = await (liquidityManagerService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
      expect(mockClient.readContract).toHaveBeenCalledWith({
        abi: expect.anything(),
        functionName: 'balanceOf',
        address: '0xWETHAddress',
        args: [walletAddress]
      })
    })
    
    it('should return rebalance request when WETH balance exceeds threshold', async () => {
      const walletAddress = '0xWalletAddress'
      const chainId = 1
      const token = { 
        chainId: 1, 
        address: '0xToken1',
        type: 'erc20',
        targetBalance: 100, 
        minBalance: 50
      }
      
      // Mock client with high WETH balance
      const wethBalance = 200n
      const mockClient = {
        readContract: jest.fn().mockResolvedValue(wethBalance),
        kernelAccount: { address: walletAddress }
      }
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue(mockClient)
      
      // Mock WETH config with lower threshold
      const wethAddress = '0xWETHAddress'
      const mockWETHConfig = {
        addresses: { 1: wethAddress },
        threshold: '100' // Lower than current balance
      }
      ecoConfigService.getWETH = jest.fn().mockReturnValue(mockWETHConfig)
      
      // Mock token data response
      const mockTokenOut = { 
        config: { address: '0xToken1', chainId: 1 },
        balance: { balance: 50n }
      }
      balanceService.getAllTokenDataForAddress = jest.fn().mockResolvedValue([mockTokenOut])
      
      // Mock quote response
      const mockQuotes = [{ amountIn: 100n, amountOut: 95n }]
      liquidityProviderService.getQuote = jest.fn().mockResolvedValue(mockQuotes)
      
      const result = await (liquidityManagerService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      // Verify the result structure
      expect(result).toBeDefined()
      expect(result.token).toEqual({
        chainId,
        config: { 
          address: wethAddress, 
          chainId, 
          type: 'erc20', 
          targetBalance: 0, 
          minBalance: 0 
        },
        balance: { 
          balance: wethBalance, 
          address: wethAddress, 
          decimals: 18 
        }
      })
      expect(result.quotes).toEqual(mockQuotes)
      
      // Verify liquidity provider was called correctly
      expect(liquidityProviderService.getQuote).toHaveBeenCalledWith(
        walletAddress,
        expect.objectContaining({ 
          chainId,
          config: { address: wethAddress } 
        }),
        mockTokenOut,
        expect.any(Number)
      )
    })
  })
})
