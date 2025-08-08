jest.mock('@0xsquid/sdk')

import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Squid } from '@0xsquid/sdk'
import { zeroAddress } from 'viem'

import { SquidProviderService } from './squid-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { TokenData } from '@/liquidity-manager/types/types'

const mockedSquid = jest.mocked(Squid)
const mockSquidInstance = {
  init: jest.fn().mockResolvedValue(undefined),
  getRoute: jest.fn(),
  executeRoute: jest.fn(),
}
mockedSquid.mockImplementation(() => mockSquidInstance as any)

describe('SquidProviderService', () => {
  let squidProviderService: SquidProviderService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let kernelAccountClientService: DeepMocked<KernelAccountClientService>

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquidProviderService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: KernelAccountClientService,
          useValue: createMock<KernelAccountClientService>(),
        },
      ],
    }).compile()

    squidProviderService = module.get<SquidProviderService>(SquidProviderService)
    ecoConfigService = module.get(EcoConfigService)
    kernelAccountClientService = module.get(KernelAccountClientService)

    ecoConfigService.getSquid.mockReturnValue({
      integratorId: 'test-integrator',
      baseUrl: 'https://test.api.squidrouter.com',
    })
    ecoConfigService.getLiquidityManager.mockReturnValue({
      swapSlippage: 0.01,
    } as any)
    kernelAccountClientService.getAddress.mockResolvedValue(zeroAddress)
  })

  describe('onModuleInit', () => {
    it('should initialize the Squid SDK', async () => {
      await squidProviderService.onModuleInit()
      expect(Squid).toHaveBeenCalledWith({
        baseUrl: 'https://test.api.squidrouter.com',
        integratorId: 'test-integrator',
      })
      expect(mockSquidInstance.init).toHaveBeenCalled()
    })
  })

  describe('getQuote', () => {
    it('should get a quote and return it in the correct format', async () => {
      await squidProviderService.onModuleInit()
      const mockTokenIn: TokenData = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: { original: 18, current: 18 } },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: { original: 6, current: 18 } },
      } as any
      const mockSwapAmount = BigInt('100000000000000000000') // 100 tokens in BASE_DECIMALS (18)

      const mockRoute = {
        estimate: {
          fromAmount: '100000000000000000000',
          toAmount: '99000000',
          toAmountMin: '98010000',
        },
      }

      mockSquidInstance.getRoute.mockResolvedValue({ route: mockRoute } as any)

      const quotes = await squidProviderService.getQuote(mockTokenIn, mockTokenOut, mockSwapAmount)
      const quote = quotes[0]

      // amountIn and amountOut are now normalized using convertNormScalar
      // fromAmount: '100000000000000000000' with 18 decimals -> 100000000000000000000n
      // toAmount: '99000000' with 6 decimals -> 99000000000000000000n (normalized to 18 decimals)
      expect(quote.amountIn).toBe(BigInt('100000000000000000000'))
      expect(quote.amountOut).toBe(BigInt('99000000000000000000'))
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
      await squidProviderService.onModuleInit()
      const mockTokenIn: TokenData = {
        chainId: 1,
        config: { address: '0xTokenIn' },
        balance: { decimals: { original: 18, current: 18 } },
      } as any
      const mockTokenOut: TokenData = {
        chainId: 10,
        config: { address: '0xTokenOut' },
        balance: { decimals: { original: 6, current: 18 } },
      } as any
      mockSquidInstance.getRoute.mockRejectedValue(new Error('No route found'))

      await expect(squidProviderService.getQuote(mockTokenIn, mockTokenOut, 100n)).rejects.toThrow(
        'No route found',
      )
    })
  })

  describe('execute', () => {
    it('should execute a valid quote', async () => {
      await squidProviderService.onModuleInit()
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
      await squidProviderService.onModuleInit()
      const otherAddress = '0x1234567890123456789012345678901234567890'
      await expect(squidProviderService.execute(otherAddress, {} as any)).rejects.toThrow(
        'The kernel account config is invalid',
      )
    })
  })
})
