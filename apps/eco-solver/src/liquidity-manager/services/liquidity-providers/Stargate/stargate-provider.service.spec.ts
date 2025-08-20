import { Test, TestingModule } from '@nestjs/testing'
import { StargateProviderService } from './stargate-provider.service'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { KernelAccountClientV2Service } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service'
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types'
import { StargateQuote, StargateStep } from './types/stargate-quote.interface'
import { Hex } from "viem"
import { EcoError } from '@eco-solver/common/errors/eco-error'

// Mock global fetch
global.fetch = jest.fn()

describe('StargateProviderService', () => {
  let service: StargateProviderService
  let ecoConfigService: EcoConfigService
  let kernelAccountClientV2Service: KernelAccountClientV2Service
  let multiChainPublicClientService: MultichainPublicClientService

  const mockTokenData: TokenData = {
    chainId: 1, // Ethereum
    config: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Ethereum
      chainId: 1,
      type: 'erc20',
      targetBalance: 1000,
      minBalance: 100,
    },
    balance: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      balance: 1000n,
      decimals: 6,
    },
  }

  const mockTokenDataOut: TokenData = {
    chainId: 137, // Polygon
    config: {
      address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC on Polygon
      chainId: 137,
      type: 'erc20',
      targetBalance: 1000,
      minBalance: 100,
    },
    balance: {
      address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
      balance: 500n,
      decimals: 6,
    },
  }

  const mockWalletAddress = '0x0C0d18aa99B02946C70EAC6d47b8009b993c9BfF'
  const mockClient = {
    account: { address: mockWalletAddress },
    sendTransaction: jest.fn().mockResolvedValue('0xmocktxhash'),
  }
  const mockPublicClient = {
    waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
  }

  // Mock Stargate API responses
  const mockChainsResponse = {
    chains: [
      { chainId: 1, chainKey: 'ethereum' },
      { chainId: 137, chainKey: 'polygon' },
    ],
  }

  const mockStepApprove: StargateStep = {
    type: 'approve',
    sender: mockWalletAddress,
    chainKey: 'ethereum',
    transaction: {
      value: '0',
      data: '0x095ea7b3000000000000000000000000c026395860db2d07ee33e05fe50ed7bd583189c70000000000000000000000000000000000000000000000000000000000989680',
      to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      from: mockWalletAddress,
    },
  }

  const mockStepSwap: StargateStep = {
    type: 'swap',
    sender: mockWalletAddress,
    chainKey: 'ethereum',
    transaction: {
      data: '0x095ea7b3000000000000000000000000c026395860db2d07ee33e05fe50ed7bd583189c70000000000000000000000000000000000000000000000000000000000989681',
      to: '0xdf0770dF86a8034b3EFEf0A1Bb3c889B8332FF56',
      from: mockWalletAddress,
      value: '0',
    },
  }

  const mockStargateQuote: StargateQuote = {
    bridge: 'StargateV2Bridge:taxi',
    srcAddress: mockWalletAddress,
    dstAddress: mockWalletAddress,
    srcChainKey: 'ethereum',
    dstChainKey: 'polygon',
    error: null,
    srcToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    dstToken: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    srcAmount: '10000000',
    srcAmountMax: '74660843412',
    dstAmount: '9900000',
    dstAmountMin: '9900000',
    duration: {
      estimated: 180.828,
    },
    allowance: '0',
    dstNativeAmount: '0',
    fees: [
      {
        token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        amount: '26345818528554',
        type: 'message',
        chainKey: 'ethereum',
      },
    ],
    steps: [mockStepApprove, mockStepSwap],
  }

  const mockRoutesResponse = {
    routes: [mockStargateQuote],
  }

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StargateProviderService,
        {
          provide: EcoConfigService,
          useValue: {
            getIntentSources: jest.fn().mockReturnValue([
              {
                chainID: 1,
                address: '0xmockaddress',
              },
            ]),
          },
        },
        {
          provide: KernelAccountClientV2Service,
          useValue: {
            getClient: jest.fn().mockResolvedValue(mockClient),
            getAddress: jest.fn().mockResolvedValue(mockWalletAddress),
          },
        },
        {
          provide: MultichainPublicClientService,
          useValue: {
            getClient: jest.fn().mockResolvedValue(mockPublicClient),
          },
        },
      ],
    }).compile()

    service = module.get<StargateProviderService>(StargateProviderService)
    ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
    ecoConfigService.getLiquidityManager = jest.fn().mockReturnValue({
      maxQuoteSlippage: 0.5,
    })
    kernelAccountClientV2Service = module.get<KernelAccountClientV2Service>(
      KernelAccountClientV2Service,
    )
    multiChainPublicClientService = module.get<MultichainPublicClientService>(
      MultichainPublicClientService,
    )

    // Mock fetch for chains
    ;(fetch as jest.Mock).mockImplementation((url) => {
      if (url === 'https://stargate.finance/api/v1/chains') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockChainsResponse),
        })
      }
      if (url.includes('https://stargate.finance/api/v1/routes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRoutesResponse),
        })
      }
      return Promise.reject(new Error(`Unhandled mock for URL: ${url}`))
    })
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should initialize wallet address on module init', async () => {
    await service.onModuleInit()
    expect(ecoConfigService.getIntentSources).toHaveBeenCalled()
    expect(kernelAccountClientV2Service.getClient).toHaveBeenCalledWith(1)
    expect(service['walletAddress']).toEqual(mockWalletAddress)
  })

  it('should return the correct strategy name', () => {
    expect(service.getStrategy()).toEqual('Stargate')
  })

  describe('getQuote', () => {
    it('should get a quote successfully', async () => {
      const quote = await service.getQuote(mockTokenData, mockTokenDataOut, 10)

      // Verify fetch was called with the correct URL params
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://stargate.finance/api/v1/routes'),
      )
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`srcToken=${mockTokenData.config.address}`),
      )
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`dstToken=${mockTokenDataOut.config.address}`),
      )
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('srcChainKey=ethereum'))
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('dstChainKey=polygon'))

      // Verify quote structure
      expect(quote).toMatchObject({
        amountIn: BigInt(mockStargateQuote.srcAmount),
        amountOut: BigInt(mockStargateQuote.dstAmountMin),
        tokenIn: mockTokenData,
        tokenOut: mockTokenDataOut,
        strategy: 'Stargate',
      })

      // Verify slippage calculation
      const expectedSlippage =
        1 - Number(mockStargateQuote.dstAmountMin) / Number(mockStargateQuote.srcAmount)
      expect(quote.slippage).toEqual(expectedSlippage)

      // Verify context is the Stargate quote
      expect(quote.context).toEqual(mockStargateQuote)
    })

    it('should throw an error if chain keys cannot be found', async () => {
      // Mock the getChainKey method to return undefined
      jest.spyOn(service as any, 'getChainKey').mockResolvedValueOnce(undefined)

      await expect(service.getQuote(mockTokenData, mockTokenDataOut, 10)).rejects.toThrow()
    })

    it('should throw an error if the API returns an error', async () => {
      ;(fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        }),
      )

      await expect(service.getQuote(mockTokenData, mockTokenDataOut, 10)).rejects.toThrow()
    })

    it('should throw an error if no routes are returned', async () => {
      ;(fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ chains: [] }),
        }),
      )

      await expect(service.getQuote(mockTokenData, mockTokenDataOut, 10)).rejects.toThrow(
        EcoError.RebalancingRouteNotFound().message,
      )
    })
  })

  describe('execute', () => {
    let mockQuote: RebalanceQuote<'Stargate'>

    beforeEach(() => {
      mockQuote = {
        amountIn: BigInt(mockStargateQuote.srcAmount),
        amountOut: BigInt(mockStargateQuote.dstAmountMin),
        slippage: 0.01,
        tokenIn: mockTokenData,
        tokenOut: mockTokenDataOut,
        strategy: 'Stargate',
        context: mockStargateQuote,
      }
    })

    it('should execute a quote successfully', async () => {
      await service.execute(mockWalletAddress, mockQuote)

      // Should have called getClient for both steps
      expect(kernelAccountClientV2Service.getClient).toHaveBeenCalledWith(1) // ethereum chainId
      expect(kernelAccountClientV2Service.getClient).toHaveBeenCalledTimes(2)

      // Should have sent two transactions (one for each step)
      expect(mockClient.sendTransaction).toHaveBeenCalledTimes(2)
      expect(mockClient.sendTransaction).toHaveBeenCalledWith({
        to: mockStepApprove.transaction.to as Hex,
        data: mockStepApprove.transaction.data as Hex,
        value: 0n,
      })
      expect(mockClient.sendTransaction).toHaveBeenCalledWith({
        to: mockStepSwap.transaction.to as Hex,
        data: mockStepSwap.transaction.data as Hex,
        value: 0n,
      })

      // Should have waited for transaction receipts
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledTimes(2)
    })

    it('should throw an error if wallet address does not match', async () => {
      await expect(service.execute('0xdifferentAddress', mockQuote)).rejects.toThrow(
        'Stargate is not configured with the provided wallet',
      )
    })

    it('should throw an error if transaction execution fails', async () => {
      mockClient.sendTransaction.mockRejectedValueOnce(new Error('Transaction failed'))

      await expect(service.execute(mockWalletAddress, mockQuote)).rejects.toThrow(
        'Transaction failed',
      )
    })
  })

  describe('chain key management', () => {
    it('should load chain keys from the API', async () => {
      await service['loadChainKeys']()

      expect(fetch).toHaveBeenCalledWith('https://stargate.finance/api/v1/chains')
      expect(service['chainKeyMap']).toEqual({
        1: 'ethereum',
        137: 'polygon',
      })
    })

    it('should get a chain key for a known chain ID', async () => {
      await service['loadChainKeys']()
      const chainKey = await service['getChainKey'](1)
      expect(chainKey).toEqual('ethereum')
    })

    it('should get a chain ID from a known chain key', async () => {
      await service['loadChainKeys']()
      const chainId = await service['getChainIdFromChainKey']('ethereum')
      expect(chainId).toEqual(1)
    })

    it('should throw an error for unknown chain key', async () => {
      await service['loadChainKeys']()
      await expect(service['getChainIdFromChainKey']('unknown')).rejects.toThrow(
        EcoError.RebalancingRouteNotFound().message,
      )
    })

    it('should handle API errors when loading chain keys', async () => {
      ;(fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        }),
      )

      await expect(service['loadChainKeys']()).rejects.toThrow()
    })
  })

  describe('selectRoute', () => {
    it('should select the first route', () => {
      const routes = [mockStargateQuote, { ...mockStargateQuote, dstAmountMin: '9800000' }]
      const selected = service['selectRoute'](routes)
      expect(selected).toEqual(mockStargateQuote)
    })

    it('should throw an error if no routes are available', () => {
      expect(() => service['selectRoute']([])).toThrow(EcoError.RebalancingRouteNotFound().message)
    })
  })

  describe('calculateAmountMin', () => {
    it('calculates correct minimum for 50% max slippage', () => {
      const amountIn = 1000n
      const expected = 500n // 50% slippage

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('calculates correct minimum for small slippage with ceiling rounding', () => {
      // Override the mock to use 0.5% slippage for this test (0.005)
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.005,
      })

      const amountIn = 123456789n
      const expected = 122839506n

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('calculates correct minimum for 1% slippage', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.01,
      })

      const amountIn = 1000000n
      const expected = 990000n // 99% of input

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('calculates correct minimum for 0.1% slippage', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.001,
      })

      const amountIn = 1000000n
      const expected = 999000n // 99.9% of input

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('handles zero slippage', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0,
      })

      const amountIn = 1000000n
      const expected = 1000000n // 100% of input

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('handles very large amounts correctly', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.02, // 2% slippage
      })

      const amountIn = 10000000000000000000n // 10^19
      const expected = 9800000000000000000n // 98% of input

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('handles small amounts with rounding', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.005, // 0.5% slippage
      })

      const amountIn = 100n
      const expected = 100n // Ceil-div ensures we round up

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('properly rounds up to avoid underestimating protection', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.0001, // 0.01% slippage (1 basis point)
      })

      const amountIn = 99999n
      const expected = 99990n // Should round up due to ceil-div

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('handles edge case with 1 unit input', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.5, // 50% slippage
      })

      const amountIn = 1n
      const expected = 1n // Ceil-div ensures minimum of 1

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('calculates correct minimum for 5% slippage', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.05, // 5% slippage
      })

      const amountIn = 2000000n
      const expected = 1900000n // 95% of input

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('handles fractional basis points correctly', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.0123, // 1.23% slippage
      })

      const amountIn = 1000000n
      // slippageBps = floor(0.0123 * 10000) = 123
      // slippageFactor = 10000 - 123 = 9877
      // result = ceil(1000000 * 9877 / 10000) = ceil(987700) = 987700
      const expected = 987700n

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('verifies ceil-div implementation with remainder', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.003, // 0.3% slippage
      })

      const amountIn = 333333n
      // slippageBps = 30
      // slippageFactor = 9970
      // result = ceil(333333 * 9970 / 10000) = ceil(3323331.01) = 332334
      const expected = 332334n

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('handles maximum theoretical slippage', () => {
      ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
        maxQuoteSlippage: 0.9999, // 99.99% slippage
      })

      const amountIn = 1000000n
      // slippageBps = floor(0.9999 * 10000) = 9999
      // slippageFactor = 10000 - 9999 = 1
      // result = ceil(1000000 * 1 / 10000) = ceil(100) = 100
      const expected = 100n

      const result = (service as any).calculateAmountMin(amountIn)
      expect(result).toEqual(expected)
    })

    it('ensures result never exceeds input amount', () => {
      // Test various slippage values to ensure amountMin <= amountIn
      const testCases = [0, 0.001, 0.01, 0.1, 0.5, 0.99]
      const amountIn = 1234567890n

      testCases.forEach((slippage) => {
        ;(ecoConfigService.getLiquidityManager as jest.Mock).mockReturnValue({
          maxQuoteSlippage: slippage,
        })

        const result = (service as any).calculateAmountMin(amountIn)
        expect(result).toBeLessThanOrEqual(amountIn)
        expect(result).toBeGreaterThan(0n)
      })
    })
  })
})
