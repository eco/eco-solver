jest.mock('@lifi/sdk')

import { zeroAddress } from 'viem'
import { FlowProducer, Queue } from 'bullmq'
import { Test, TestingModule } from '@nestjs/testing'
import { BullModule, getFlowProducerToken, getQueueToken } from '@nestjs/bullmq'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import * as LiFi from '@lifi/sdk'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'

describe('LiFiProviderService', () => {
  let lifiProviderService: LiFiProviderService
  let kernelAccountClientService: KernelAccountClientV2Service
  let ecoConfigService: DeepMocked<EcoConfigService>

  beforeEach(async () => {
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
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('OnModuleInit', () => {
    it('should configure LiFi SDK on init', async () => {
      const mockGetClient = jest.spyOn(kernelAccountClientService, 'getClient')
      mockGetClient.mockReturnValue({ account: { address: '0x123' } } as any)

      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([{ chainID: 10 }] as any)

      const rpcUrls = { '10': 'http://op.rpc.com' }
      jest.spyOn(ecoConfigService, 'getChainRpcs').mockReturnValue(rpcUrls)

      await lifiProviderService.onModuleInit()

      expect(mockGetClient).toHaveBeenCalled()
      expect(lifiProviderService['walletAddress']).toEqual('0x123')
      expect(LiFi.createConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          integrator: 'Eco',
          rpcUrls: { '10': [rpcUrls['10']] },
        }),
      )
    })
  })

  describe('getQuote', () => {
    it('should return a quote for direct route', async () => {
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
    it('should return a quote through a core token', async () => {
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
})
