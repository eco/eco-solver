jest.mock('@lifi/sdk')

import { zeroAddress } from 'viem'
import { FlowProducer, Queue } from 'bullmq'
import { Test, TestingModule } from '@nestjs/testing'
import { BullModule, getFlowProducerToken, getQueueToken } from '@nestjs/bullmq'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import * as LiFi from '@lifi/sdk'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RpcBalanceService } from '@/balance/services/rpc-balance.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'

describe('LiFiProviderService', () => {
  let lifiProviderService: LiFiProviderService
  let kernelAccountClientService: KernelAccountClientV2Service
  let balanceService: DeepMocked<RpcBalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        LiFiProviderService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: RpcBalanceService, useValue: createMock<RpcBalanceService>() },
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
    balanceService = chainMod.get(RpcBalanceService)
    lifiProviderService = chainMod.get(LiFiProviderService)
    kernelAccountClientService = chainMod.get(KernelAccountClientV2Service)

    kernelAccountClientService['getAddress'] = jest.fn().mockResolvedValue(zeroAddress)

    jest.spyOn(ecoConfigService, 'getLiFi').mockReturnValue({ integrator: 'Eco' })
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
    it('should return quotes through a core token', async () => {
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
      const mockRoute1 = {
        fromAmount: '1000000000000000000',
        toAmount: '3000000000000000000',
        toAmountMin: '2900000000000000000',
        steps: [],
      }
      const mockRoute2 = {
        fromAmount: '2900000000000000000',
        toAmount: '2800000000000000000',
        toAmountMin: '2700000000000000000',
        steps: [],
      }

      // Mock getLiquidityManager to return core tokens
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue({
        coreTokens: [mockCoreToken],
      } as any)

      // Mock getAllTokenDataForAddress to return proper core token data
      jest.spyOn(balanceService, 'getAllTokenDataForAddress').mockResolvedValue([
        {
          chainId: mockCoreToken.chainID,
          config: {
            address: mockCoreToken.token,
            chainId: mockCoreToken.chainID,
          },
          balance: { decimals: 18 },
        },
      ] as any)

      // Create a spy on the getQuote method to verify it's called
      const getQuoteSpy = jest.spyOn(lifiProviderService, 'getQuote')
      getQuoteSpy
        .mockResolvedValueOnce({
          amountIn: BigInt(mockRoute1.fromAmount),
          amountOut: BigInt(mockRoute1.toAmount),
          slippage: 0.03,
          tokenIn: mockTokenIn,
          tokenOut: mockCoreToken,
          strategy: 'LiFi',
          context: mockRoute1,
        } as any)
        .mockResolvedValueOnce({
          amountIn: BigInt(mockRoute2.fromAmount),
          amountOut: BigInt(mockRoute2.toAmount),
          slippage: 0.02,
          tokenIn: mockCoreToken,
          tokenOut: mockTokenOut,
          strategy: 'LiFi',
          context: mockRoute2,
        } as any)

      // Call the fallback method
      const result = await lifiProviderService.fallback(mockTokenIn as any, mockTokenOut as any, 1)

      // Verify the result is an array with two quotes
      expect(result).toHaveLength(2)
      expect(result[0].amountIn).toEqual(BigInt(mockRoute1.fromAmount))
      expect(result[0].amountOut).toEqual(BigInt(mockRoute1.toAmount))
      expect(result[0].tokenIn).toEqual(mockTokenIn)
      expect(result[0].tokenOut).toEqual(mockCoreToken)
      expect(result[0].strategy).toEqual('LiFi')
      expect(result[0].context).toEqual(mockRoute1)

      expect(result[1].amountIn).toEqual(BigInt(mockRoute2.fromAmount))
      expect(result[1].amountOut).toEqual(BigInt(mockRoute2.toAmount))
      expect(result[1].tokenIn).toEqual(mockCoreToken)
      expect(result[1].tokenOut).toEqual(mockTokenOut)
      expect(result[1].strategy).toEqual('LiFi')
      expect(result[1].context).toEqual(mockRoute2)

      // Verify that getQuote was called twice
      expect(getQuoteSpy).toHaveBeenCalledTimes(2)
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
      expect(getQuoteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: mockCoreToken.chainID,
          config: expect.objectContaining({
            address: mockCoreToken.token,
            chainId: mockCoreToken.chainID,
          }),
        }),
        mockTokenOut,
        2.9, // toAmountMin converted from the first quote
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

      // Mock getAllTokenDataForAddress to return proper core token data
      jest
        .spyOn(balanceService, 'getAllTokenDataForAddress')
        .mockImplementation((walletAddress: string, configs: any[]) => {
          if (configs.length > 0) {
            const config = configs[0]
            const coreToken = mockCoreTokens.find((ct) => ct.token === config.address)
            if (coreToken) {
              return Promise.resolve([
                {
                  chainId: coreToken.chainID,
                  config: {
                    address: coreToken.token,
                    chainId: coreToken.chainID,
                  },
                  balance: { decimals: 18 },
                },
              ] as any)
            }
          }
          return Promise.resolve([])
        })

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
      const mockRoute1 = {
        fromAmount: '1000000000000000000',
        toAmount: '3000000000000000000',
        toAmountMin: '2900000000000000000',
        steps: [],
      }
      const mockRoute2 = {
        fromAmount: '2900000000000000000',
        toAmount: '2800000000000000000',
        toAmountMin: '2700000000000000000',
        steps: [],
      }

      // Mock getLiquidityManager to return multiple core tokens
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue({
        coreTokens: mockCoreTokens,
      } as any)

      // Mock getAllTokenDataForAddress to return proper core token data
      jest
        .spyOn(balanceService, 'getAllTokenDataForAddress')
        .mockImplementation((walletAddress: string, configs: any[]) => {
          if (configs.length > 0) {
            const config = configs[0]
            const coreToken = mockCoreTokens.find((ct) => ct.token === config.address)
            if (coreToken) {
              return Promise.resolve([
                {
                  chainId: coreToken.chainID,
                  config: {
                    address: coreToken.token,
                    chainId: coreToken.chainID,
                  },
                  balance: { decimals: 18 },
                },
              ] as any)
            }
          }
          return Promise.resolve([])
        })

      // Mock getQuote to fail for first core token but succeed for second
      const getQuoteSpy = jest.spyOn(lifiProviderService, 'getQuote')
      let callCount = 0
      getQuoteSpy.mockImplementation((tokenIn: any, tokenOut: any) => {
        callCount++
        if (callCount === 1) {
          // First call with first core token fails
          return Promise.reject(new Error('Route not found'))
        } else if (callCount === 2) {
          // Second call with second core token succeeds
          return Promise.resolve({
            amountIn: BigInt(mockRoute1.fromAmount),
            amountOut: BigInt(mockRoute1.toAmount),
            slippage: 0.05,
            tokenIn: mockTokenIn,
            tokenOut: { config: { address: mockCoreTokens[1].token } },
            strategy: 'LiFi',
            context: mockRoute1,
          } as any)
        } else {
          // Third call from core token to tokenOut
          return Promise.resolve({
            amountIn: BigInt(mockRoute2.fromAmount),
            amountOut: BigInt(mockRoute2.toAmount),
            slippage: 0.02,
            tokenIn: { config: { address: mockCoreTokens[1].token } },
            tokenOut: mockTokenOut,
            strategy: 'LiFi',
            context: mockRoute2,
          } as any)
        }
      })

      // Call the fallback method
      const result = await lifiProviderService.fallback(mockTokenIn as any, mockTokenOut as any, 1)

      // Verify the result is an array with two quotes
      expect(result).toHaveLength(2)
      expect(result[0].amountIn).toEqual(BigInt(mockRoute1.fromAmount))
      expect(result[0].tokenIn).toEqual(mockTokenIn)
      expect(result[1].amountIn).toEqual(BigInt(mockRoute2.fromAmount))
      expect(result[1].tokenOut).toEqual(mockTokenOut)

      // Verify that getQuote was called 3 times (1 fail, 2 success)
      expect(getQuoteSpy).toHaveBeenCalledTimes(3)
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
