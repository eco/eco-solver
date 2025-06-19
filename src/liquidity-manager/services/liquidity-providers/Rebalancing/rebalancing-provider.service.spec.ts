import { Test, TestingModule } from '@nestjs/testing'
import { RebalancingProviderService } from './rebalancing-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { TokenData } from '@/liquidity-manager/types/types'
import { Hex } from 'viem'
import { LitActionService } from '@/lit-actions/lit-action.service'

describe('RebalancingProviderService', () => {
  let service: RebalancingProviderService
  let ecoConfigService: EcoConfigService
  let kernelAccountClientService: KernelAccountClientService
  let publicClient: MultichainPublicClientService
  let litActionService: LitActionService

  const mockTokenIn: TokenData = {
    config: {
      address: '0x1111111111111111111111111111111111111111' as Hex,
      chainId: 1,
      minBalance: 1000,
      targetBalance: 5000,
      type: 'erc20',
    },
    balance: {
      address: '0x1111111111111111111111111111111111111111' as Hex,
      decimals: 6,
      balance: 10000n * 10n ** 6n,
    },
    chainId: 1,
  }

  const mockTokenOut: TokenData = {
    config: {
      address: '0x2222222222222222222222222222222222222222' as Hex,
      chainId: 10,
      minBalance: 1000,
      targetBalance: 5000,
      type: 'erc20',
    },
    balance: {
      address: '0x2222222222222222222222222222222222222222' as Hex,
      decimals: 6,
      balance: 0n,
    },
    chainId: 10,
  }

  const mockConfig = {
    enabled: true,
    targetSlippage: 0.1,
    maxQuoteSlippage: 0.05,
    intervalDuration: 60000,
    thresholds: {
      surplus: 0.2,
      deficit: 0.2,
    },
    coreTokens: [],
    walletStrategies: {},
    rebalancingPercentage: 0.05, // 5% loss for fulfillers
  }

  const mockIntentSource = {
    network: 'ethereum' as any,
    chainID: 1,
    sourceAddress: '0x3333333333333333333333333333333333333333' as Hex,
    inbox: '0x4444444444444444444444444444444444444444' as Hex,
    tokens: ['0x1111111111111111111111111111111111111111' as Hex],
    provers: ['0x5555555555555555555555555555555555555555' as Hex],
  }

  const mockCrowdLiquidityConfig = {
    litNetwork: 'datil-test' as any,
    capacityTokenId: 'test-capacity-token',
    capacityTokenOwnerPk: '0x1234567890123456789012345678901234567890123456789012345678901234',
    defaultTargetBalance: 1000,
    feePercentage: 0.01,
    actions: {
      fulfill: 'ipfs://fulfill-action',
      rebalance: 'ipfs://rebalance-action',
      negativeIntentRebalance: 'ipfs://negative-intent-rebalance',
    },
    kernel: {
      address: '0x6666666666666666666666666666666666666666',
    },
    pkp: {
      ethAddress: '0x7777777777777777777777777777777777777777',
      publicKey: 'test-public-key',
    },
    supportedTokens: [],
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RebalancingProviderService,
        {
          provide: EcoConfigService,
          useValue: {
            getLiquidityManager: jest.fn().mockReturnValue(mockConfig),
            getIntentSources: jest.fn().mockReturnValue([mockIntentSource]),
            getCrowdLiquidity: jest.fn().mockReturnValue(mockCrowdLiquidityConfig),
          },
        },
        {
          provide: KernelAccountClientService,
          useValue: {
            getClient: jest.fn().mockResolvedValue({
              sendTransaction: jest.fn().mockResolvedValue('0xmocktxhash'),
              waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 'success' }),
              kernelAccount: {
                address: '0x7777777777777777777777777777777777777777',
              },
              chain: { id: 1, name: 'ethereum' },
            }),
            getAddress: jest.fn().mockResolvedValue('0x7777777777777777777777777777777777777777'),
          },
        },
        {
          provide: MultichainPublicClientService,
          useValue: {
            getClient: jest.fn().mockResolvedValue({
              getBlock: jest.fn().mockResolvedValue({ baseFeePerGas: 1000n }),
              estimateMaxPriorityFeePerGas: jest.fn().mockResolvedValue(100n),
              getTransactionCount: jest.fn().mockResolvedValue(1),
            }),
          },
        },
        {
          provide: LitActionService,
          useValue: {
            executeNegativeIntentRebalanceAction: jest.fn().mockResolvedValue('0xfulfilltxhash'),
          },
        },
      ],
    }).compile()

    service = module.get<RebalancingProviderService>(RebalancingProviderService)
    ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
    kernelAccountClientService = module.get<KernelAccountClientService>(KernelAccountClientService)
    publicClient = module.get<MultichainPublicClientService>(MultichainPublicClientService)
    litActionService = module.get<LitActionService>(LitActionService)
  })

  describe('getStrategy', () => {
    it('should return Rebalancing strategy', () => {
      expect(service.getStrategy()).toBe('Rebalancing')
    })
  })

  describe('getQuote', () => {
    it('should calculate correct quote with 5% loss', async () => {
      const result = await service.getQuote(mockTokenIn, mockTokenOut, 1000, 'test-id')

      expect(result.tokenIn).toBe(mockTokenIn)
      expect(result.tokenOut).toBe(mockTokenOut)
      expect(result.amountIn).toBe(1000n * 10n ** 6n)
      expect(result.amountOut).toBe(950n * 10n ** 6n) // 95% of 1000 = 950 USDC
      expect(result.slippage).toBe(0.05)
      expect(result.strategy).toBe('Rebalancing')
      expect(result.context.rebalancingPercentage).toBe(0.05)
      expect(result.id).toBe('test-id')
    })

    it('should use default 5% if rebalancingPercentage not configured', async () => {
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue({
        ...mockConfig,
        rebalancingPercentage: undefined,
      })

      const result = await service.getQuote(mockTokenIn, mockTokenOut, 2000)

      expect(result.amountOut).toBe(1900n * 10n ** 6n) // 95% of 2000 = 1900 USDC
      expect(result.slippage).toBe(0.05)
    })
  })

  describe('execute', () => {
    it('should execute a rebalancing quote successfully', async () => {
      const quote = await service.getQuote(mockTokenIn, mockTokenOut, 1000, 'test-id')
      const result = await service.execute(mockCrowdLiquidityConfig.kernel.address, quote)

      expect(result).toBe('0xmocktxhash')
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(1)
      
      const client = await kernelAccountClientService.getClient(1)
      expect(client.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockIntentSource.sourceAddress,
          data: expect.any(String),
          value: 0n,
          account: expect.objectContaining({
            address: '0x7777777777777777777777777777777777777777',
          }),
        }),
      )
    })

    it('should throw error if wallet is not crowd liquidity pool', async () => {
      const quote = await service.getQuote(mockTokenIn, mockTokenOut, 1000, 'test-id')
      
      await expect(service.execute('0xwrongaddress', quote)).rejects.toThrow(
        'Rebalancing intents can only be executed by the crowd liquidity pool',
      )
    })

    it('should throw error if amountOut >= amountIn', async () => {
      const quote = {
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        amountIn: 1000n * 10n ** 6n,
        amountOut: 1000n * 10n ** 6n, // Same amount, no loss
        slippage: 0,
        strategy: 'Rebalancing' as const,
        context: {
          intentHash: '0x' as Hex,
          rebalancingPercentage: 0,
        },
      }

      await expect(service.execute(mockCrowdLiquidityConfig.kernel.address, quote)).rejects.toThrow(
        'Rebalancing intent must have amountOut < amountIn',
      )
    })

    it('should throw error if no intent source found for chain', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue([])

      const quote = await service.getQuote(mockTokenIn, mockTokenOut, 1000, 'test-id')

      await expect(service.execute(mockCrowdLiquidityConfig.kernel.address, quote)).rejects.toThrow(
        'No intent source found for chain 1',
      )
    })
  })


  describe('intent structure', () => {
    it('should create correct route structure', async () => {
      const quote = await service.getQuote(mockTokenIn, mockTokenOut, 1000, 'test-id')

      await service.execute(mockCrowdLiquidityConfig.kernel.address, quote)

      const client = await kernelAccountClientService.getClient(1)
      const callArgs = (client.sendTransaction as jest.Mock).mock.calls[0][0]
      
      // Verify the transaction target is the intent source
      expect(callArgs.to).toBe(mockIntentSource.sourceAddress)
      
      // Verify the data includes the transfer selector (it's embedded in the publishAndFund encoded data)
      // The test shows that 0xa9059cbb (transfer selector) is present in the encoded data
      expect(callArgs.data).toContain('a9059cbb') // transfer selector without 0x prefix
    })
  })
})