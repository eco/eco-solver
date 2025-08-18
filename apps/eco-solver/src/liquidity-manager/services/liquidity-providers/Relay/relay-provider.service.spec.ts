import { Test, TestingModule } from '@nestjs/testing'
import { RelayProviderService } from './relay-provider.service'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { KernelAccountClientV2Service } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { WalletClient } from 'viem'
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types'
import { createClient, Execute as RelayQuote, getClient } from '@reservoir0x/relay-sdk'
import { ChainsSupported } from '@eco-solver/common/chains/supported'

// Mock the relay-sdk
jest.mock('@reservoir0x/relay-sdk', () => {
  const mockQuote = {
    details: {
      currencyIn: {
        amount: '1000000000000000000',
      },
      currencyOut: {
        minimumAmount: '990000000000000000',
      },
    },
  }

  const executeResult = {
    status: 'success',
    txHashes: ['0xabc123'],
  }

  return {
    createClient: jest.fn(),
    getClient: jest.fn().mockReturnValue({
      actions: {
        getQuote: jest.fn().mockResolvedValue(mockQuote),
        execute: jest.fn().mockResolvedValue(executeResult),
      },
    }),
    convertViemChainToRelayChain: jest.fn().mockReturnValue({}),
  }
})
jest.mock('@/liquidity-manager/services/liquidity-providers/Relay/wallet-adapter.ts', () => ({
  adaptKernelWallet: jest.fn().mockImplementation((param) => param),
}))

describe('RelayProviderService', () => {
  let service: RelayProviderService
  let ecoConfigService: EcoConfigService
  let kernelAccountClientV2Service: KernelAccountClientV2Service

  const mockTokenData: TokenData = {
    chainId: 1,
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
    chainId: 10,
    config: {
      address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC on Optimism
      chainId: 10,
      type: 'erc20',
      targetBalance: 1000,
      minBalance: 100,
    },
    balance: {
      address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
      balance: 500n,
      decimals: 6,
    },
  }

  const mockWalletClient = {
    account: { address: '0x123abc' },
  } as unknown as WalletClient

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelayProviderService,
        {
          provide: EcoConfigService,
          useValue: {
            getSupportedChains: jest.fn().mockReturnValue([1n, 10n, 137n]),
          },
        },
        {
          provide: KernelAccountClientV2Service,
          useValue: {
            getClient: jest.fn().mockResolvedValue(mockWalletClient),
            getAddress: () => Promise.resolve('0x123abc'),
          },
        },
      ],
    }).compile()

    service = module.get<RelayProviderService>(RelayProviderService)
    ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
    kernelAccountClientV2Service = module.get<KernelAccountClientV2Service>(
      KernelAccountClientV2Service,
    )

    // Bypass the onModuleInit for unit tests
    jest.spyOn(ChainsSupported, 'find').mockReturnValue({
      id: 1,
      name: 'Ethereum',
    } as any)
  })

  it('should initialize the Relay client on module init', async () => {
    await service.onModuleInit()

    expect(createClient).toHaveBeenCalled()
  })

  it('should get a quote successfully', async () => {
    const quote = await service.getQuote(mockTokenData, mockTokenDataOut, 100)

    expect(kernelAccountClientV2Service.getClient).toHaveBeenCalledWith(mockTokenData.chainId)
    expect(getClient().actions.getQuote).toHaveBeenCalledWith({
      chainId: mockTokenData.chainId,
      toChainId: mockTokenDataOut.chainId,
      user: '0x123abc',
      recipient: '0x123abc',
      currency: mockTokenData.config.address,
      toCurrency: mockTokenDataOut.config.address,
      amount: expect.any(String),
      wallet: mockWalletClient,
      tradeType: 'EXACT_INPUT',
    })

    expect(quote).toMatchObject({
      // Using toMatchObject instead of toEqual to avoid floating point precision issues
      tokenIn: mockTokenData,
      tokenOut: mockTokenDataOut,
      amountIn: 1000000000000000000n,
      amountOut: 990000000000000000n,
      strategy: 'Relay',
    })
    expect(quote.slippage).toBeCloseTo(0.01, 5) // 1% slippage as per our mock
    expect(quote.context).toBeDefined()
  })

  it('should execute a quote successfully', async () => {
    const { getClient } = require('@reservoir0x/relay-sdk')
    const mockContext = {} as RelayQuote
    const mockQuote: RebalanceQuote<'Relay'> = {
      slippage: 0.01,
      tokenIn: mockTokenData,
      tokenOut: mockTokenDataOut,
      amountIn: 1000000000000000000n,
      amountOut: 990000000000000000n,
      strategy: 'Relay',
      context: mockContext,
    }

    const result = await service.execute('0x123abc', mockQuote)

    expect(kernelAccountClientV2Service.getClient).toHaveBeenCalledWith(mockTokenData.chainId)
    expect(getClient().actions.execute).toHaveBeenCalledWith({
      quote: mockQuote.context,
      wallet: mockWalletClient,
      onProgress: expect.any(Function),
    })

    expect(result).toEqual({
      status: 'success',
      txHashes: ['0xabc123'],
    })
  })

  it('should throw an error if wallet address does not match', async () => {
    const mockContext = {} as RelayQuote
    const mockQuote: RebalanceQuote<'Relay'> = {
      slippage: 0.01,
      tokenIn: mockTokenData,
      tokenOut: mockTokenDataOut,
      amountIn: 1000000000000000000n,
      amountOut: 990000000000000000n,
      strategy: 'Relay',
      context: mockContext,
    }

    await expect(service.execute('0xdifferentAddress', mockQuote)).rejects.toThrow(
      'Wallet address mismatch for Relay execution',
    )
  })

  it('should handle errors when getting a quote', async () => {
    const { getClient } = require('@reservoir0x/relay-sdk')
    getClient().actions.getQuote.mockRejectedValueOnce(new Error('Failed to get quote'))

    await expect(service.getQuote(mockTokenData, mockTokenDataOut, 100)).rejects.toThrow(
      'Failed to get quote',
    )
  })

  it('should handle errors when executing a quote', async () => {
    const { getClient } = require('@reservoir0x/relay-sdk')
    getClient().actions.execute.mockRejectedValueOnce(new Error('Failed to execute quote'))

    const mockContext = {} as RelayQuote
    const mockQuote: RebalanceQuote<'Relay'> = {
      slippage: 0.01,
      tokenIn: mockTokenData,
      tokenOut: mockTokenDataOut,
      amountIn: 1000000000000000000n,
      amountOut: 990000000000000000n,
      strategy: 'Relay',
      context: mockContext,
    }

    await expect(service.execute('0x123abc', mockQuote)).rejects.toThrow('Failed to execute quote')
  })

  it('should throw when details are missing in the quote response', async () => {
    const { getClient } = require('@reservoir0x/relay-sdk')
    getClient().actions.getQuote.mockResolvedValueOnce({})

    await expect(service.getQuote(mockTokenData, mockTokenDataOut, 100)).rejects.toThrow()
  })

  it('should throw when amount details are missing in the quote response', async () => {
    const { getClient } = require('@reservoir0x/relay-sdk')
    getClient().actions.getQuote.mockResolvedValueOnce({
      details: {
        currencyIn: {},
        currencyOut: {},
      },
    })

    await expect(service.getQuote(mockTokenData, mockTokenDataOut, 100)).rejects.toThrow()
  })
})
