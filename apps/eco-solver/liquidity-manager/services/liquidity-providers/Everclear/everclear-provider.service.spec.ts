import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EverclearProviderService } from './everclear-provider.service'
import { EcoConfigService } from '@eco/infrastructure-config'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { getQueueToken } from '@nestjs/bullmq'
import { TokenData } from '@/liquidity-manager/types/types'
import { Hex, parseUnits } from 'viem'
import { EverclearApiError } from './everclear.errors'

import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'

// Mock global fetch
global.fetch = jest.fn()

describe('EverclearProviderService', () => {
  let service: EverclearProviderService
  let configService: DeepMocked<EcoConfigService>
  let kernelAccountClientService: DeepMocked<KernelAccountClientService>
  let mockQueue: any
  let mockStartCheckEverclearIntent: jest.SpyInstance
  let getTokenSymbolSpy: jest.SpyInstance

  const mockWalletAddress: Hex = '0x1234567890123456789012345678901234567890'

  const mockTokenIn: TokenData = {
    chainId: 1,
    config: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
      chainId: 1,
      type: 'erc20',
      minBalance: 0,
      targetBalance: 0,
    },
    balance: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      balance: parseUnits('1000', 6),
      decimals: 6,
    },
  }

  const mockTokenOut: TokenData = {
    chainId: 10,
    config: {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC on Optimism
      chainId: 10,
      type: 'erc20',
      minBalance: 0,
      targetBalance: 0,
    },
    balance: {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      balance: parseUnits('1000', 6),
      decimals: 6,
    },
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    // Spy on the LiquidityManagerQueue instance method before module compilation
    mockStartCheckEverclearIntent = jest
      .spyOn(LiquidityManagerQueue.prototype, 'startCheckEverclearIntent')
      .mockResolvedValue()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EverclearProviderService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
        { provide: getQueueToken(LiquidityManagerQueue.queueName), useValue: createMock<any>() },
        {
          provide: CACHE_MANAGER,
          useValue: createMock<Cache>(),
        },
      ],
    }).compile()

    service = module.get<EverclearProviderService>(EverclearProviderService)
    configService = module.get(EcoConfigService)
    kernelAccountClientService = module.get(KernelAccountClientService)
    mockQueue = module.get(getQueueToken(LiquidityManagerQueue.queueName))

    // Setup default mocks
    configService.getEverclear.mockReturnValue({ baseUrl: 'https://test.everclear.org' })
    kernelAccountClientService.getAddress.mockResolvedValue(mockWalletAddress)
    getTokenSymbolSpy = jest
      .spyOn(service as any, 'getTokenSymbol')
      .mockImplementation(async (chainId: number, address: Hex) => {
        if (address === mockTokenIn.config.address) return 'USDC'
        if (address === mockTokenOut.config.address) return 'USDC'
        return 'UNKNOWN'
      })

    await service.onModuleInit()
  })

  afterEach(() => {
    mockStartCheckEverclearIntent.mockRestore()
    getTokenSymbolSpy.mockRestore()
  })

  describe('getStrategy', () => {
    it("should return 'Everclear'", () => {
      expect(service.getStrategy()).toBe('Everclear')
    })
  })

  describe('getQuote', () => {
    it('should get a quote and return it in the correct format', async () => {
      const swapAmount = 100
      const expectedAmount = parseUnits('99', 6).toString() // 1% slippage
      const mockApiResponse = { expectedAmount }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const [quote] = await service.getQuote(mockTokenIn, mockTokenOut, swapAmount)

      expect(fetch).toHaveBeenCalledWith(
        'https://test.everclear.org/routes/quotes',
        expect.any(Object),
      )
      expect(quote.strategy).toBe('Everclear')
      expect(quote.amountIn).toBe(parseUnits(swapAmount.toString(), 6))
      expect(quote.amountOut).toBe(BigInt(expectedAmount))
      expect(quote.slippage).toBeCloseTo(0.01)
    })

    it('should return an empty array if token symbols do not match', async () => {
      getTokenSymbolSpy.mockImplementation(async (chainId: number, address: Hex) => {
        if (address === mockTokenIn.config.address) return 'USDC'
        if (address === mockTokenOut.config.address) return 'WETH'
        return 'UNKNOWN'
      })

      const quotes = await service.getQuote(mockTokenIn, mockTokenOut, 100)
      expect(quotes).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should throw EverclearApiError on API failure', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: () => Promise.resolve('Internal Server Error'),
      })

      await expect(service.getQuote(mockTokenIn, mockTokenOut, 100)).rejects.toThrow(
        EverclearApiError,
      )
    })
  })

  describe('execute', () => {
    const mockTxRequest = {
      to: '0x0000000000000000000000000000000000000001',
      data: '0xabcdef',
      value: '0',
    }

    const mockQuote = {
      tokenIn: mockTokenIn,
      tokenOut: mockTokenOut,
      amountIn: parseUnits('100', 6),
      id: 'test-id',
    } as any

    const mockClient = {
      account: { address: mockWalletAddress },
      chain: { id: 1 },
      execute: jest.fn().mockResolvedValue('0xTransactionHash'),
      waitForTransactionReceipt: jest
        .fn()
        .mockResolvedValue({ transactionHash: '0xTransactionHash' }),
    }

    beforeEach(() => {
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)
    })

    it('should execute a quote successfully and queue a monitoring job', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTxRequest),
      })

      const txHash = await service.execute(mockWalletAddress, mockQuote)

      expect(fetch).toHaveBeenCalledWith('https://test.everclear.org/intents', expect.any(Object))
      expect(mockClient.execute).toHaveBeenCalledWith([
        {
          to: mockTokenIn.config.address,
          data: expect.any(String), // The approve data
        },
        {
          to: mockTxRequest.to,
          data: mockTxRequest.data,
          value: BigInt(mockTxRequest.value),
        },
      ])
      expect(mockStartCheckEverclearIntent).toHaveBeenCalledWith({
        txHash,
        id: 'test-id',
      })
      expect(txHash).toBe('0xTransactionHash')
    })

    it('should throw EverclearApiError on intent creation failure', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid input'),
      })

      await expect(service.execute(mockWalletAddress, mockQuote)).rejects.toThrow(EverclearApiError)
      expect(mockStartCheckEverclearIntent).not.toHaveBeenCalled()
    })

    it('should throw an error if token symbols do not match', async () => {
      getTokenSymbolSpy.mockImplementation(async (chainId: number, address: Hex) => {
        if (address === mockTokenIn.config.address) return 'USDC'
        if (address === mockTokenOut.config.address) return 'WETH'
        return 'UNKNOWN'
      })

      await expect(service.execute(mockWalletAddress, mockQuote)).rejects.toThrow(
        'Everclear: cross-token swaps are not supported',
      )
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should re-throw transaction error', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTxRequest),
      })
      mockClient.execute.mockRejectedValueOnce(new Error('Transaction failed'))

      await expect(service.execute(mockWalletAddress, mockQuote)).rejects.toThrow(
        'Transaction failed',
      )
      expect(mockStartCheckEverclearIntent).not.toHaveBeenCalled()
    })

    it('should throw if kernel client is missing account or chain', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTxRequest),
      })
      kernelAccountClientService.getClient.mockResolvedValueOnce({} as any) // No account/chain

      await expect(service.execute(mockWalletAddress, mockQuote)).rejects.toThrow(
        'Kernel client account or chain is not available.',
      )
    })
  })

  describe('checkIntentStatus', () => {
    const txHash: Hex = '0xIntentTxHash'

    it("should return 'pending' when intent is not found by transaction_hash", async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ intents: [], nextCursor: null, prevCursor: null, maxCount: 0 }),
      })

      const result = await service.checkIntentStatus(txHash)
      expect(result.status).toBe('pending')
      expect(fetch).toHaveBeenCalledWith(`https://test.everclear.org/intents?txHash=${txHash}`)
    })

    it("should return 'pending' on initial API fetch failure", async () => {
      ;(fetch as jest.Mock).mockResolvedValue({ ok: false })

      const result = await service.checkIntentStatus(txHash)
      expect(result.status).toBe('pending')
    })

    it("should return 'pending' for NONE status", async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            intents: [
              {
                intent_id: 'intent-123',
                status: 'NONE',
              },
            ],
          }),
      })

      const result = await service.checkIntentStatus(txHash)
      expect(result.status).toBe('pending')
      expect(result.intentId).toBe('intent-123')
    })

    it("should return 'pending' for FILLED status", async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            intents: [
              {
                intent_id: 'intent-123',
                status: 'FILLED',
              },
            ],
          }),
      })

      const result = await service.checkIntentStatus(txHash)
      expect(result.status).toBe('pending')
      expect(result.intentId).toBe('intent-123')
    })

    it("should return 'complete' for SETTLED_AND_COMPLETED status", async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            intents: [
              {
                intent_id: 'intent-123',
                status: 'SETTLED_AND_COMPLETED',
              },
            ],
          }),
      })

      const result = await service.checkIntentStatus(txHash)
      expect(result.status).toBe('complete')
      expect(result.intentId).toBe('intent-123')
    })

    it("should return 'failed' for UNSUPPORTED status", async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            intents: [
              {
                intent_id: 'intent-123',
                status: 'UNSUPPORTED',
              },
            ],
          }),
      })

      const result = await service.checkIntentStatus(txHash)
      expect(result.status).toBe('failed')
      expect(result.intentId).toBe('intent-123')
    })

    it("should return 'pending' for an unknown status", async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            intents: [
              {
                intent_id: 'intent-123',
                status: 'UNKNOWN_STATUS',
              },
            ],
          }),
      })

      const result = await service.checkIntentStatus(txHash)
      expect(result.status).toBe('pending')
    })
  })
})
