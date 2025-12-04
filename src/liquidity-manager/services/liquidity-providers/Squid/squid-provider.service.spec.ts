jest.mock('@0xsquid/sdk')

import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Squid } from '@0xsquid/sdk'
import { zeroAddress } from 'viem'

import { SquidProviderService } from './squid-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { TokenData } from '@/liquidity-manager/types/types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'

const mockedSquid = jest.mocked(Squid)
const mockSquidInstance = {
  init: jest.fn().mockResolvedValue(undefined),
  getRoute: jest.fn(),
  executeRoute: jest.fn(),
  tokens: [
    { chainId: '1', address: '0xTokenIn' },
    { chainId: '10', address: '0xTokenOut' },
  ],
}

describe('SquidProviderService', () => {
  let squidProviderService: SquidProviderService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let kernelAccountClientService: DeepMocked<LmTxGatedKernelAccountClientService>

  beforeEach(async () => {
    jest.clearAllMocks()

    // Re-apply mock implementation after clearAllMocks
    mockedSquid.mockImplementation(() => mockSquidInstance as any)

    ecoConfigService = createMock<EcoConfigService>()
    kernelAccountClientService = createMock<LmTxGatedKernelAccountClientService>()

    ecoConfigService.getSquid.mockReturnValue({
      integratorId: 'test-integrator',
      baseUrl: 'https://test.api.squidrouter.com',
    })
    ecoConfigService.getLiquidityManager.mockReturnValue({
      swapSlippage: 0.01,
    } as any)
    kernelAccountClientService.getAddress.mockResolvedValue(zeroAddress)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquidProviderService,
        { provide: RebalanceRepository, useValue: createMock<RebalanceRepository>() },
        { provide: EcoConfigService, useValue: ecoConfigService },
        {
          provide: LmTxGatedKernelAccountClientService,
          useValue: kernelAccountClientService,
        },
      ],
    }).compile()

    squidProviderService = module.get<SquidProviderService>(SquidProviderService)
  })

  describe('initialization', () => {
    it('should initialize the Squid SDK lazily on first method call', async () => {
      // Squid SDK should NOT be initialized in constructor
      expect(Squid).not.toHaveBeenCalled()
      expect(mockSquidInstance.init).not.toHaveBeenCalled()

      // Call a method that triggers initialization
      const mockTokenIn: TokenData = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: 6 },
      } as any

      await squidProviderService.isRouteAvailable(mockTokenIn, mockTokenOut)

      // Now initialization should have happened
      expect(Squid).toHaveBeenCalledWith({
        baseUrl: 'https://test.api.squidrouter.com',
        integratorId: 'test-integrator',
      })
      expect(mockSquidInstance.init).toHaveBeenCalled()
    })

    it('should only initialize once even when called multiple times', async () => {
      const mockTokenIn: TokenData = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: 6 },
      } as any

      // Call isRouteAvailable multiple times
      await squidProviderService.isRouteAvailable(mockTokenIn, mockTokenOut)
      await squidProviderService.isRouteAvailable(mockTokenIn, mockTokenOut)

      // Initialization should only happen once
      expect(Squid).toHaveBeenCalledTimes(1)
      expect(mockSquidInstance.init).toHaveBeenCalledTimes(1)
    })
  })

  describe('isRouteAvailable', () => {
    it('should return true when both tokens are in the Squid token list', async () => {
      const mockTokenIn: TokenData = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: 6 },
      } as any

      const result = await squidProviderService.isRouteAvailable(mockTokenIn, mockTokenOut)
      expect(result).toBe(true)
    })

    it('should return false when source token is not in the Squid token list', async () => {
      const mockTokenIn: TokenData = {
        chainId: 1,
        config: { address: '0xUnsupportedToken' },
        balance: { decimals: 18 },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: 6 },
      } as any

      const result = await squidProviderService.isRouteAvailable(mockTokenIn, mockTokenOut)
      expect(result).toBe(false)
    })

    it('should return false when destination token is not in the Squid token list', async () => {
      const mockTokenIn: TokenData = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xUnsupportedToken' },
        balance: { decimals: 6 },
      } as any

      const result = await squidProviderService.isRouteAvailable(mockTokenIn, mockTokenOut)
      expect(result).toBe(false)
    })

    it('should return false when source chain does not match token list', async () => {
      const mockTokenIn: TokenData = {
        chainId: 999, // Different chain than in token list
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: 6 },
      } as any

      const result = await squidProviderService.isRouteAvailable(mockTokenIn, mockTokenOut)
      expect(result).toBe(false)
    })
  })

  describe('getQuote', () => {
    it('should get a quote and return it in the correct format', async () => {
      const mockTokenIn: TokenData = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: 6 },
      } as any
      const mockSwapAmount = 100

      const mockRoute = {
        estimate: {
          fromAmount: '100000000000000000000',
          toAmount: '99000000',
          toAmountMin: '98010000',
        },
        transactionRequest: {
          target: '0x1234567890123456789012345678901234567890',
          data: '0xabcdef',
          value: '0',
        },
      }

      mockSquidInstance.getRoute.mockResolvedValue({ route: mockRoute } as any)

      const quotes = await squidProviderService.getQuote(mockTokenIn, mockTokenOut, mockSwapAmount)
      const quote = quotes[0]

      expect(quote.amountIn).toBe(BigInt(mockRoute.estimate.fromAmount))
      expect(quote.amountOut).toBe(BigInt(mockRoute.estimate.toAmount))
      expect(quote.strategy).toBe('Squid')
      expect(quote.context).toBe(mockRoute)
      expect(mockSquidInstance.getRoute).toHaveBeenCalledWith({
        fromAddress: zeroAddress,
        fromChain: '1',
        fromToken: '0xTokenIn',
        fromAmount: '100000000000000000000',
        toChain: '10',
        toToken: '0xTokenOut',
        toAddress: zeroAddress,
        slippage: 1,
        quoteOnly: false,
      })
    })

    it('should throw if squid.getRoute fails', async () => {
      const mockTokenIn: TokenData = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: 18 },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: 6 },
      } as any
      mockSquidInstance.getRoute.mockRejectedValue(new Error('No route found'))

      await expect(squidProviderService.getQuote(mockTokenIn, mockTokenOut, 100)).rejects.toThrow(
        'No route found',
      )
    })
  })

  describe('execute', () => {
    it('should execute a valid quote', async () => {
      const mockRoute = {
        estimate: { fromAmount: '100', toAmount: '95', toAmountMin: '94' },
        transactionRequest: {
          target: zeroAddress,
          data: '0xdeadbeef',
          value: '0',
        },
        params: {
          fromToken: '0xToken',
          fromAmount: '100',
        },
      }
      const mockQuote = {
        tokenIn: { chainId: 1 },
        context: mockRoute,
        id: 'test-id',
      } as any

      const executeMock = jest.fn().mockResolvedValue('0xTxHash')
      const waitMock = jest.fn().mockResolvedValue({ transactionHash: '0xTxHash' })

      kernelAccountClientService.getClient.mockResolvedValue({
        execute: executeMock,
        waitForTransactionReceipt: waitMock,
      } as any)

      const result = await squidProviderService.execute(zeroAddress, mockQuote)

      expect(result).toBe('0xTxHash')
      expect(executeMock).toHaveBeenCalledTimes(1)
    })

    it('should throw an error for a non-kernel wallet address', async () => {
      const otherAddress = '0x1234567890123456789012345678901234567890'
      await expect(squidProviderService.execute(otherAddress, {} as any)).rejects.toThrow(
        'The kernel account config is invalid',
      )
    })
  })
})
