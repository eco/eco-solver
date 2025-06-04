jest.mock('@lifi/sdk')
jest.mock('@/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager')

import { zeroAddress } from 'viem'
import { FlowProducer, Queue } from 'bullmq'
import { Test, TestingModule } from '@nestjs/testing'
import { BullModule, getFlowProducerToken, getQueueToken } from '@nestjs/bullmq'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import * as LiFi from '@lifi/sdk'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { LiFiAssetCacheManager } from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'

describe('LiFiProviderService', () => {
  let lifiProviderService: LiFiProviderService
  let kernelAccountClientService: KernelAccountClientV2Service
  let ecoConfigService: DeepMocked<EcoConfigService>
  let mockAssetCacheManager: DeepMocked<LiFiAssetCacheManager>

  beforeEach(async () => {
    // Create mock for LiFiAssetCacheManager
    mockAssetCacheManager = createMock<LiFiAssetCacheManager>()

    // Mock the constructor to return our mock
    ;(LiFiAssetCacheManager as jest.MockedClass<typeof LiFiAssetCacheManager>).mockImplementation(
      () => mockAssetCacheManager,
    )

    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        LiFiProviderService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: KernelAccountClientV2Service,
          useValue: createMock<KernelAccountClientV2Service>(),
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

    ecoConfigService = chainMod.get(EcoConfigService)
    lifiProviderService = chainMod.get(LiFiProviderService)
    kernelAccountClientService = chainMod.get(KernelAccountClientV2Service)

    kernelAccountClientService['getAddress'] = jest.fn().mockResolvedValue(zeroAddress)

    // Setup default cache manager behavior
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
  })

  afterEach(() => {
    jest.restoreAllMocks()
    // Reset LiFi SDK mocks
    jest.clearAllMocks()
  })

  describe('OnModuleInit', () => {
    it('should configure LiFi SDK and initialize cache on init', async () => {
      const mockGetClient = jest.spyOn(kernelAccountClientService, 'getClient')
      mockGetClient.mockReturnValue({ account: { address: '0x123' } } as any)

      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([{ chainID: 10 }] as any)

      const rpcUrls = { '10': 'http://op.rpc.com' }
      jest.spyOn(ecoConfigService, 'getChainRPCs').mockReturnValue(rpcUrls)

      await lifiProviderService.onModuleInit()

      expect(mockGetClient).toHaveBeenCalled()
      expect(lifiProviderService['walletAddress']).toEqual('0x123')
      expect(LiFi.createConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          integrator: 'Eco',
          rpcUrls: { '10': [rpcUrls['10']] },
        }),
      )
      expect(mockAssetCacheManager.initialize).toHaveBeenCalled()
    })

    it('should handle cache initialization failure gracefully', async () => {
      const mockGetClient = jest.spyOn(kernelAccountClientService, 'getClient')
      mockGetClient.mockReturnValue({ account: { address: '0x123' } } as any)

      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([{ chainID: 10 }] as any)
      jest.spyOn(ecoConfigService, 'getChainRPCs').mockReturnValue({ '10': 'http://op.rpc.com' })

      // Mock cache initialization failure
      mockAssetCacheManager.initialize.mockRejectedValue(new Error('Cache init failed'))

      await lifiProviderService.onModuleInit()

      expect(mockAssetCacheManager.initialize).toHaveBeenCalled()
      // Service should continue to work even if cache fails
      expect(lifiProviderService['walletAddress']).toEqual('0x123')
    })
  })

  describe('getQuote', () => {
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
        toAmount: '2000000000000000000',
        toAmountMin: '1900000000000000000',
        steps: [],
      }
      jest.spyOn(LiFi, 'getRoutes').mockResolvedValue({ routes: [mockRoute] } as any)

      const result = await lifiProviderService.getQuote(mockTokenIn as any, mockTokenOut as any, 1)

      expect(result.amountIn).toEqual(BigInt(mockRoute.fromAmount))
      expect(result.amountOut).toEqual(BigInt(mockRoute.toAmount))
      expect(result.slippage).toBeCloseTo(0.05)
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

  describe('fallback', () => {
    it('should return a quote through a core token when supported', async () => {
      // Setup mocks
      const mockTokenIn = {
        chainId: 1,
        config: { address: '0xTokenIn', chainId: 1 },
        balance: { decimals: 18 },
      }
      const mockTokenOut = {
        chainId: 2,
        config: { address: '0xTokenOut', chainId: 2 },
        balance: { decimals: 18 },
      }
      const mockCoreToken = {
        token: '0xCoreToken',
        chainID: 3,
      }
      const mockRoute = {
        fromAmount: '1000000000000000000',
        toAmount: '3000000000000000000',
        toAmountMin: '2900000000000000000',
        steps: [],
      }

      // Mock getLiquidityManager to return core tokens
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue({
        coreTokens: [mockCoreToken],
      } as any)

      // Create a spy on the getQuote method to verify it's called
      const getQuoteSpy = jest.spyOn(lifiProviderService, 'getQuote')
      getQuoteSpy.mockResolvedValue({
        amountIn: BigInt(mockRoute.fromAmount),
        amountOut: BigInt(mockRoute.toAmount),
        slippage: 0.05,
        tokenIn: mockTokenIn,
        tokenOut: mockCoreToken,
        strategy: 'LiFi',
        context: mockRoute,
      } as any)

      // Call the fallback method
      const result = await lifiProviderService.fallback(mockTokenIn as any, mockTokenOut as any, 1)

      // Verify the result matches what getQuote returns
      expect(result.amountIn).toEqual(BigInt(mockRoute.fromAmount))
      expect(result.amountOut).toEqual(BigInt(mockRoute.toAmount))
      expect(result.tokenIn).toEqual(mockTokenIn)
      expect(result.tokenOut).toEqual(mockCoreToken)
      expect(result.strategy).toEqual('LiFi')
      expect(result.context).toEqual(mockRoute)

      // Verify that getQuote was called with the right parameters
      expect(getQuoteSpy).toHaveBeenCalledWith(
        mockTokenIn,
        expect.objectContaining({
          chainId: mockCoreToken.chainID,
          config: expect.objectContaining({
            address: mockCoreToken.token,
            chainId: mockCoreToken.chainID,
          }),
        }),
        1,
      )
    })

    it('should skip unsupported core tokens and try next one', async () => {
      const mockTokenIn = {
        chainId: 1,
        config: { address: '0xTokenIn', chainId: 1 },
        balance: { decimals: 18 },
      }
      const mockTokenOut = {
        chainId: 2,
        config: { address: '0xTokenOut', chainId: 2 },
        balance: { decimals: 18 },
      }
      const unsupportedCoreToken = {
        token: '0xUnsupportedCoreToken',
        chainID: 999, // Unsupported chain
      }
      const supportedCoreToken = {
        token: '0xSupportedCoreToken',
        chainID: 3,
      }
      const mockRoute = {
        fromAmount: '1000000000000000000',
        toAmount: '3000000000000000000',
        toAmountMin: '2900000000000000000',
        steps: [],
      }

      // Mock getLiquidityManager to return multiple core tokens
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue({
        coreTokens: [unsupportedCoreToken, supportedCoreToken],
      } as any)

      // Mock validation to reject unsupported core token
      mockAssetCacheManager.isChainSupported.mockImplementation((chainId) => chainId !== 999)

      // Create a spy on the getQuote method
      const getQuoteSpy = jest.spyOn(lifiProviderService, 'getQuote')
      getQuoteSpy.mockResolvedValue({
        amountIn: BigInt(mockRoute.fromAmount),
        amountOut: BigInt(mockRoute.toAmount),
        slippage: 0.05,
        tokenIn: mockTokenIn,
        tokenOut: supportedCoreToken,
        strategy: 'LiFi',
        context: mockRoute,
      } as any)

      // Call the fallback method
      const result = await lifiProviderService.fallback(mockTokenIn as any, mockTokenOut as any, 1)

      // Verify the result uses the supported core token
      expect(result.tokenOut).toEqual(supportedCoreToken)

      // Verify that getQuote was only called for the supported core token
      expect(getQuoteSpy).toHaveBeenCalledTimes(1)
      expect(getQuoteSpy).toHaveBeenCalledWith(
        mockTokenIn,
        expect.objectContaining({
          chainId: supportedCoreToken.chainID,
          config: expect.objectContaining({
            address: supportedCoreToken.token,
            chainId: supportedCoreToken.chainID,
          }),
        }),
        1,
      )
    })

    it('should try multiple core tokens and throw error when all fail', async () => {
      const mockTokenIn = {
        chainId: 1,
        config: { address: '0xTokenIn', chainId: 1 },
        balance: { decimals: 18 },
      }
      const mockTokenOut = {
        chainId: 2,
        config: { address: '0xTokenOut', chainId: 2 },
        balance: { decimals: 18 },
      }
      const mockCoreTokens = [
        { token: '0xCoreToken1', chainID: 3 },
        { token: '0xCoreToken2', chainID: 4 },
      ]

      // Mock getLiquidityManager to return multiple core tokens
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue({
        coreTokens: mockCoreTokens,
      } as any)

      // Mock getQuote to fail for all core tokens
      const getQuoteSpy = jest.spyOn(lifiProviderService, 'getQuote')
      getQuoteSpy.mockRejectedValue(new Error('Route not found'))

      // Call should throw an error after trying all core tokens
      await expect(
        lifiProviderService.fallback(mockTokenIn as any, mockTokenOut as any, 1),
      ).rejects.toThrow()

      // Verify getQuote was called for each core token
      expect(getQuoteSpy).toHaveBeenCalledTimes(mockCoreTokens.length)
    })

    it('should return first successful core token route', async () => {
      const mockTokenIn = {
        chainId: 1,
        config: { address: '0xTokenIn', chainId: 1 },
        balance: { decimals: 18 },
      }
      const mockTokenOut = {
        chainId: 2,
        config: { address: '0xTokenOut', chainId: 2 },
        balance: { decimals: 18 },
      }
      const mockCoreTokens = [
        { token: '0xCoreToken1', chainID: 3 },
        { token: '0xCoreToken2', chainID: 4 },
      ]
      const mockRoute = {
        fromAmount: '1000000000000000000',
        toAmount: '3000000000000000000',
        toAmountMin: '2900000000000000000',
        steps: [],
      }

      // Mock getLiquidityManager to return multiple core tokens
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue({
        coreTokens: mockCoreTokens,
      } as any)

      // Mock getQuote to fail for first core token but succeed for second
      const getQuoteSpy = jest.spyOn(lifiProviderService, 'getQuote')
      getQuoteSpy.mockImplementation((tokenIn: any, tokenOut: any) => {
        if (tokenOut.config.address === mockCoreTokens[0].token) {
          return Promise.reject(new Error('Route not found'))
        } else {
          return Promise.resolve({
            amountIn: BigInt(mockRoute.fromAmount),
            amountOut: BigInt(mockRoute.toAmount),
            slippage: 0.05,
            tokenIn: mockTokenIn,
            tokenOut: { config: { address: mockCoreTokens[1].token } },
            strategy: 'LiFi',
            context: mockRoute,
          } as any)
        }
      })

      // Call the fallback method
      const result = await lifiProviderService.fallback(mockTokenIn as any, mockTokenOut as any, 1)

      // Verify the result matches what getQuote returns for the second core token
      expect(result.amountIn).toEqual(BigInt(mockRoute.fromAmount))
      expect(result.tokenIn).toEqual(mockTokenIn)

      // Verify that getQuote was called for the first core token
      expect(getQuoteSpy).toHaveBeenCalledWith(
        mockTokenIn,
        expect.objectContaining({
          config: expect.objectContaining({
            address: mockCoreTokens[0].token,
          }),
        }),
        1,
      )
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
