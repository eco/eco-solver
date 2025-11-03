jest.mock('@lifi/sdk')
jest.mock('@/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager')

import { zeroAddress } from 'viem'
import { FlowProducer, Queue } from 'bullmq'
import { Test, TestingModule } from '@nestjs/testing'
import { BullModule, getFlowProducerToken, getQueueToken } from '@nestjs/bullmq'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import * as LiFi from '@lifi/sdk'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { LiFiAssetCacheManager } from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager'
import { EcoAnalyticsService } from '@/analytics'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { LmTxGatedKernelAccountClientV2Service } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client-v2.service'

describe('LiFiProviderService', () => {
  let lifiProviderService: LiFiProviderService
  let kernelAccountClientService: DeepMocked<LmTxGatedKernelAccountClientV2Service>
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let mockAssetCacheManager: DeepMocked<LiFiAssetCacheManager>

  beforeEach(async () => {
    // Create mock for LiFiAssetCacheManager
    mockAssetCacheManager = createMock<LiFiAssetCacheManager>()

    // Mock the constructor to return our mock
    ;(LiFiAssetCacheManager as jest.MockedClass<typeof LiFiAssetCacheManager>).mockImplementation(
      () => mockAssetCacheManager,
    )

    // Setup default cache manager behavior BEFORE module compilation
    mockAssetCacheManager.initialize.mockResolvedValue()
    mockAssetCacheManager.isChainSupported.mockReturnValue(true)
    mockAssetCacheManager.isTokenSupported.mockReturnValue(true)
    mockAssetCacheManager.areTokensConnected.mockReturnValue(true)
    mockAssetCacheManager.getCacheStatus.mockReturnValue({
      isInitialized: true,
      isValid: true,
      lastUpdated: new Date(),
      nextRefresh: new Date(),
      totalChains: 2,
      totalTokens: 100,
      cacheAge: 1000,
    })

    // Create mocks with default implementations BEFORE test module compilation
    ecoConfigService = createMock<EcoConfigService>()
    kernelAccountClientService = createMock<LmTxGatedKernelAccountClientV2Service>()

    // Set up mocks BEFORE module compilation (constructor will call initialize)
    ecoConfigService.getIntentSources.mockReturnValue([{ chainID: 10 }] as any)
    ecoConfigService.getLiFi.mockReturnValue({ integrator: 'Eco' } as any)
    ecoConfigService.getChainRpcs.mockReturnValue({ '10': ['http://op.rpc.com'] })
    ecoConfigService.getLiquidityManager.mockReturnValue({
      swapSlippage: 0.001,
      maxQuoteSlippage: 0.005,
    } as any)

    kernelAccountClientService.getClient.mockReturnValue({
      account: { address: '0x123' },
    } as any)
    kernelAccountClientService.getAddress.mockResolvedValue(zeroAddress)

    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        LiFiProviderService,
        { provide: RebalanceRepository, useValue: createMock<RebalanceRepository>() },
        { provide: EcoConfigService, useValue: ecoConfigService },
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        {
          provide: LmTxGatedKernelAccountClientV2Service,
          useValue: kernelAccountClientService,
        },
        {
          provide: EcoAnalyticsService,
          useValue: createMock<EcoAnalyticsService>(),
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
    lifiProviderService = chainMod.get(LiFiProviderService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    // Reset LiFi SDK mocks
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should configure LiFi SDK and initialize cache lazily on first method call', async () => {
      // Initialization should NOT happen in constructor
      expect(LiFi.createConfig).not.toHaveBeenCalled()
      expect(mockAssetCacheManager.initialize).not.toHaveBeenCalled()

      // Call a method that triggers initialization
      const mockRoute = {
        fromAmount: '1000000',
        toAmount: '1000000',
        toAmountMin: '995000',
        steps: [],
      }
      jest.spyOn(LiFi, 'getRoutes').mockResolvedValue({ routes: [mockRoute] } as any)

      await lifiProviderService.getQuote(
        { chainId: 1, config: { address: '0xA' }, balance: { decimals: 6 } } as any,
        { chainId: 1, config: { address: '0xB' }, balance: { decimals: 6 } } as any,
        1,
      )

      // Now initialization should have happened
      expect(LiFi.createConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          integrator: 'Eco',
        }),
      )
      expect(mockAssetCacheManager.initialize).toHaveBeenCalled()
    })

    it('should only initialize once even when called multiple times', async () => {
      const mockRoute = {
        fromAmount: '1000000',
        toAmount: '1000000',
        toAmountMin: '995000',
        steps: [],
      }
      jest.spyOn(LiFi, 'getRoutes').mockResolvedValue({ routes: [mockRoute] } as any)

      // Call getQuote multiple times
      await lifiProviderService.getQuote(
        { chainId: 1, config: { address: '0xA' }, balance: { decimals: 6 } } as any,
        { chainId: 1, config: { address: '0xB' }, balance: { decimals: 6 } } as any,
        1,
      )
      await lifiProviderService.getQuote(
        { chainId: 1, config: { address: '0xA' }, balance: { decimals: 6 } } as any,
        { chainId: 1, config: { address: '0xB' }, balance: { decimals: 6 } } as any,
        1,
      )

      // Initialization should only happen once
      expect(LiFi.createConfig).toHaveBeenCalledTimes(1)
      expect(mockAssetCacheManager.initialize).toHaveBeenCalledTimes(1)
    })
  })

  describe('isRouteAvailable', () => {
    it('should return true when both tokens and chains are supported', async () => {
      mockAssetCacheManager.isChainSupported.mockReturnValue(true)
      mockAssetCacheManager.isTokenSupported.mockReturnValue(true)
      mockAssetCacheManager.areTokensConnected.mockReturnValue(true)

      const result = await lifiProviderService.isRouteAvailable(
        { chainId: 1, config: { address: '0xTokenIn' }, balance: { decimals: 6 } } as any,
        { chainId: 10, config: { address: '0xTokenOut' }, balance: { decimals: 6 } } as any,
      )
      expect(result).toBe(true)
    })

    it('should return false when source chain is not supported', async () => {
      mockAssetCacheManager.isChainSupported.mockImplementation((chainId) => chainId !== 999)
      mockAssetCacheManager.isTokenSupported.mockReturnValue(true)
      mockAssetCacheManager.areTokensConnected.mockReturnValue(true)

      const result = await lifiProviderService.isRouteAvailable(
        { chainId: 999, config: { address: '0xTokenIn' }, balance: { decimals: 6 } } as any,
        { chainId: 10, config: { address: '0xTokenOut' }, balance: { decimals: 6 } } as any,
      )
      expect(result).toBe(false)
    })

    it('should return false when source token is not supported', async () => {
      mockAssetCacheManager.isChainSupported.mockReturnValue(true)
      mockAssetCacheManager.isTokenSupported.mockImplementation(
        (chainId, address) => address !== '0xUnsupportedToken',
      )
      mockAssetCacheManager.areTokensConnected.mockReturnValue(true)

      const result = await lifiProviderService.isRouteAvailable(
        { chainId: 1, config: { address: '0xUnsupportedToken' }, balance: { decimals: 6 } } as any,
        { chainId: 10, config: { address: '0xTokenOut' }, balance: { decimals: 6 } } as any,
      )
      expect(result).toBe(false)
    })

    it('should return false when tokens are not connected', async () => {
      mockAssetCacheManager.isChainSupported.mockReturnValue(true)
      mockAssetCacheManager.isTokenSupported.mockReturnValue(true)
      mockAssetCacheManager.areTokensConnected.mockReturnValue(false)

      const result = await lifiProviderService.isRouteAvailable(
        { chainId: 1, config: { address: '0xTokenIn' }, balance: { decimals: 6 } } as any,
        { chainId: 10, config: { address: '0xTokenOut' }, balance: { decimals: 6 } } as any,
      )
      expect(result).toBe(false)
    })
  })

  describe('getQuote', () => {
    it('passes Allow/Deny/Prefer bridges to getRoutes options', async () => {
      const mockTokenIn = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 6 },
      }
      const mockTokenOut = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: 6 },
      }

      const bridges = {
        allow: ['stargate'],
        deny: ['across'],
        prefer: ['relay'],
      }

      ecoConfigService.getLiFi.mockReturnValue({ integrator: 'Eco', bridges } as any)
      ecoConfigService.getLiquidityManager.mockReturnValue({
        swapSlippage: 0.001,
        maxQuoteSlippage: 0.005,
      } as any)

      const mockRoute = {
        fromAmount: '1000000',
        toAmount: '1000000',
        toAmountMin: '995000',
        steps: [],
      }

      const getRoutesSpy = jest
        .spyOn(LiFi, 'getRoutes')
        .mockResolvedValue({ routes: [mockRoute] } as any)

      await lifiProviderService.getQuote(mockTokenIn as any, mockTokenOut as any, 1)

      expect(getRoutesSpy).toHaveBeenCalled()
      const calledWith = getRoutesSpy.mock.calls[0][0]
      expect(calledWith).toEqual(
        expect.objectContaining({
          options: expect.objectContaining({
            bridges,
            slippage: 0.005,
          }),
        }),
      )
    })

    it('uses swapSlippage for same-chain routes and maxQuoteSlippage for cross-chain', async () => {
      const mockRoute = {
        fromAmount: '1000000',
        toAmount: '1000000',
        toAmountMin: '995000',
        steps: [],
      }

      ecoConfigService.getLiFi.mockReturnValue({ integrator: 'Eco' } as any)
      ecoConfigService.getLiquidityManager.mockReturnValue({
        swapSlippage: 0.001,
        maxQuoteSlippage: 0.005,
      } as any)

      const getRoutesSpy = jest
        .spyOn(LiFi, 'getRoutes')
        .mockResolvedValue({ routes: [mockRoute] } as any)

      // Same-chain
      await lifiProviderService.getQuote(
        { chainId: 1, config: { address: '0xA' }, balance: { decimals: 6 } } as any,
        { chainId: 1, config: { address: '0xB' }, balance: { decimals: 6 } } as any,
        1,
      )
      let calledWith = getRoutesSpy.mock.calls[getRoutesSpy.mock.calls.length - 1][0]
      expect(calledWith).toEqual(
        expect.objectContaining({
          options: expect.objectContaining({ slippage: 0.001 }),
        }),
      )

      // Cross-chain
      await lifiProviderService.getQuote(
        { chainId: 1, config: { address: '0xA' }, balance: { decimals: 6 } } as any,
        { chainId: 10, config: { address: '0xB' }, balance: { decimals: 6 } } as any,
        1,
      )
      calledWith = getRoutesSpy.mock.calls[getRoutesSpy.mock.calls.length - 1][0]
      expect(calledWith).toEqual(
        expect.objectContaining({
          options: expect.objectContaining({ slippage: 0.005 }),
        }),
      )
    })
    it('should return a quote for direct route when tokens are supported', async () => {
      const mockTokenIn = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      }
      const mockTokenOut = {
        chainId: 1,
        config: { address: '0xTokenOut' },
        balance: { decimals: 18 },
      }
      const mockRoute = {
        fromAmount: '1000000000000000000',
        toAmount: '1000000000000000000',
        toAmountMin: '900000000000000000',
        steps: [],
      }
      jest.spyOn(LiFi, 'getRoutes').mockResolvedValue({ routes: [mockRoute] } as any)

      const result = await lifiProviderService.getQuote(mockTokenIn as any, mockTokenOut as any, 1)

      expect(result.amountIn).toEqual(BigInt(mockRoute.fromAmount))
      expect(result.amountOut).toEqual(BigInt(mockRoute.toAmount))
      expect(result.slippage).toBeCloseTo(0.1)
      expect(result.tokenIn).toEqual(mockTokenIn)
      expect(result.tokenOut).toEqual(mockTokenOut)
      expect(result.strategy).toEqual('LiFi')
      expect(result.context).toEqual(mockRoute)

      // Verify validation was called
      expect(mockAssetCacheManager.isChainSupported).toHaveBeenCalledWith(1)
      expect(mockAssetCacheManager.isTokenSupported).toHaveBeenCalledWith(1, '0xTokenIn')
      expect(mockAssetCacheManager.isTokenSupported).toHaveBeenCalledWith(1, '0xTokenOut')
      expect(mockAssetCacheManager.areTokensConnected).toHaveBeenCalledWith(
        1,
        '0xTokenIn',
        1,
        '0xTokenOut',
      )
    })

    it('should throw error when source chain is not supported', async () => {
      // Clear any previous mock calls
      jest.clearAllMocks()

      const mockTokenIn = {
        chainId: 999, // Unsupported chain
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      }
      const mockTokenOut = {
        chainId: 1,
        config: { address: '0xTokenOut' },
        balance: { decimals: 18 },
      }

      // Mock unsupported source chain
      mockAssetCacheManager.isChainSupported.mockImplementation((chainId) => chainId !== 999)

      await expect(
        lifiProviderService.getQuote(mockTokenIn as any, mockTokenOut as any, 1),
      ).rejects.toThrow()

      // Verify LiFi API was not called
      expect(LiFi.getRoutes).not.toHaveBeenCalled()
    })

    it('should throw error when source token is not supported', async () => {
      // Clear any previous mock calls
      jest.clearAllMocks()

      const mockTokenIn = {
        chainId: 1,
        config: { address: '0xUnsupportedToken' },
        balance: { decimals: 18 },
      }
      const mockTokenOut = {
        chainId: 1,
        config: { address: '0xTokenOut' },
        balance: { decimals: 18 },
      }

      // Mock unsupported source token
      mockAssetCacheManager.isTokenSupported.mockImplementation(
        (chainId, address) => address !== '0xUnsupportedToken',
      )

      await expect(
        lifiProviderService.getQuote(mockTokenIn as any, mockTokenOut as any, 1),
      ).rejects.toThrow()

      // Verify LiFi API was not called
      expect(LiFi.getRoutes).not.toHaveBeenCalled()
    })

    it('should throw error when tokens are not connected', async () => {
      // Clear any previous mock calls
      jest.clearAllMocks()

      const mockTokenIn = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      }
      const mockTokenOut = {
        chainId: 2,
        config: { address: '0xTokenOut' },
        balance: { decimals: 18 },
      }

      // Mock tokens not connected
      mockAssetCacheManager.areTokensConnected.mockReturnValue(false)

      await expect(
        lifiProviderService.getQuote(mockTokenIn as any, mockTokenOut as any, 1),
      ).rejects.toThrow()

      // Verify LiFi API was not called
      expect(LiFi.getRoutes).not.toHaveBeenCalled()
    })

    it('should throw error when no direct route found', async () => {
      const mockTokenIn = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      }
      const mockTokenOut = {
        chainId: 2,
        config: { address: '0xTokenOut' },
        balance: { decimals: 18 },
      }

      // Mock getRoutes to return no routes
      jest.spyOn(LiFi, 'getRoutes').mockResolvedValue({ routes: [] } as any)

      await expect(
        lifiProviderService.getQuote(mockTokenIn as any, mockTokenOut as any, 1),
      ).rejects.toThrow()
    })
  })

  describe('execute', () => {
    it('should execute a quote', async () => {
      const mockQuote = {
        tokenIn: { config: { address: '0xTokenIn', chainId: 1 } },
        tokenOut: { config: { address: '0xTokenOut', chainId: 1 } },
        amountIn: BigInt(1000000000000000000),
        amountOut: BigInt(2000000000000000000),
        slippage: 0.05,
        context: { gasCostUSD: 10, steps: [] },
      }

      const mockExecuteRoute = jest.spyOn(LiFi, 'executeRoute')

      await lifiProviderService.execute(zeroAddress, mockQuote as any)

      expect(mockExecuteRoute).toHaveBeenCalledWith(mockQuote.context, expect.any(Object))
    })
  })

  describe('Cache Status', () => {
    it('should return cache status', () => {
      const expectedStatus = {
        isInitialized: true,
        isValid: true,
        lastUpdated: new Date(),
        nextRefresh: new Date(),
        totalChains: 5,
        totalTokens: 200,
        cacheAge: 5000,
      }

      mockAssetCacheManager.getCacheStatus.mockReturnValue(expectedStatus)

      const result = lifiProviderService.getCacheStatus()

      expect(result).toEqual(expectedStatus)
      expect(mockAssetCacheManager.getCacheStatus).toHaveBeenCalled()
    })
  })
})
