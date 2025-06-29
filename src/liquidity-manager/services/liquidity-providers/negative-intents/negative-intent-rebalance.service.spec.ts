import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { encodeFunctionData, erc20Abi, Hex, parseUnits } from 'viem'
import { NegativeIntentRebalanceService } from './negative-intent-rebalance.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { LitActionService } from '@/lit-actions/lit-action.service'
import { NegativeIntentMonitorService } from './negative-intent-monitor.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { TokenData, RebalanceQuote } from '@/liquidity-manager/types/types'
import { hashIntent, IntentSourceAbi } from '@eco-foundation/routes-ts'

jest.mock('@eco-foundation/routes-ts', () => ({
  ...jest.requireActual('@eco-foundation/routes-ts'),
  hashIntent: jest.fn(),
  IntentSourceAbi: [],
}))

describe('NegativeIntentRebalanceService', () => {
  let service: NegativeIntentRebalanceService
  let ecoConfigService: jest.Mocked<EcoConfigService>
  let litActionService: jest.Mocked<LitActionService>
  let publicClient: jest.Mocked<MultichainPublicClientService>
  let kernelAccountClientService: jest.Mocked<KernelAccountClientService>
  let walletClientDefaultSignerService: jest.Mocked<WalletClientDefaultSignerService>
  let negativeIntentMonitorService: jest.Mocked<NegativeIntentMonitorService>

  const mockTokenIn: TokenData = {
    config: {
      address: '0xTokenIn' as Hex,
      chainId: 1,
      minBalance: 100,
      targetBalance: 1000,
      type: 'token' as any,
    },
    balance: {
      address: '0xTokenIn' as Hex,
      decimals: 18,
      balance: 1000n,
    },
    chainId: 1,
  }

  const mockTokenOut: TokenData = {
    config: {
      address: '0xTokenOut' as Hex,
      chainId: 137,
      minBalance: 95,
      targetBalance: 950,
      type: 'token' as any,
    },
    balance: {
      address: '0xTokenOut' as Hex,
      decimals: 18,
      balance: 950n,
    },
    chainId: 137,
  }

  const mockKernelClient = {
    writeContract: jest.fn(),
    waitForTransactionReceipt: jest.fn(),
    chain: { id: 1 },
    kernelAccount: '0xKernelAccount',
  }

  const mockWalletClient = {
    writeContract: jest.fn(),
    extend: jest.fn().mockReturnThis(),
    waitForTransactionReceipt: jest.fn(),
  }

  const mockPublicClient = {
    getBlock: jest.fn(),
    estimateMaxPriorityFeePerGas: jest.fn(),
    getTransactionCount: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NegativeIntentRebalanceService,
        {
          provide: EcoConfigService,
          useValue: {
            getLiquidityManager: jest.fn().mockReturnValue({
              rebalancingPercentage: 0.05,
            }),
            getIntentSources: jest.fn(),
            getCrowdLiquidity: jest.fn().mockReturnValue({
              kernel: { address: '0x1234567890123456789012345678901234567890' },
              pkp: {
                publicKey: '0xPublicKey',
                ethAddress: '0x1234567890123456789012345678901234567891',
              },
            }),
          },
        },
        {
          provide: LitActionService,
          useValue: {
            executeNegativeIntentRebalanceAction: jest.fn(),
          },
        },
        {
          provide: MultichainPublicClientService,
          useValue: {
            getClient: jest.fn(),
          },
        },
        {
          provide: KernelAccountClientService,
          useValue: {
            getAddress: jest.fn().mockResolvedValue('0xKernelAddress'),
            getClient: jest.fn(),
          },
        },
        {
          provide: WalletClientDefaultSignerService,
          useValue: {
            getClient: jest.fn(),
          },
        },
        {
          provide: NegativeIntentMonitorService,
          useValue: {
            monitorNegativeIntent: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<NegativeIntentRebalanceService>(NegativeIntentRebalanceService)
    ecoConfigService = module.get(EcoConfigService)
    litActionService = module.get(LitActionService)
    publicClient = module.get(MultichainPublicClientService)
    kernelAccountClientService = module.get(KernelAccountClientService)
    walletClientDefaultSignerService = module.get(WalletClientDefaultSignerService)
    negativeIntentMonitorService = module.get(NegativeIntentMonitorService)

    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getStrategy', () => {
    it('should return NegativeIntent strategy', () => {
      expect(service.getStrategy()).toBe('NegativeIntent')
    })
  })

  describe('getQuote', () => {
    it('should calculate quote with correct rebalancing percentage', async () => {
      const swapAmount = 100
      const quote = await service.getQuote(mockTokenIn, mockTokenOut, swapAmount, 'quote-id-1')

      expect(quote.strategy).toBe('NegativeIntent')
      expect(quote.amountIn).toBe(parseUnits('100', 18))
      expect(quote.amountOut).toBe(parseUnits('95', 18)) // 100 * (1 - 0.05)
      expect(quote.slippage).toBe(0.05)
      expect(quote.context.rebalancingPercentage).toBe(0.05)
      expect(quote.id).toBe('quote-id-1')
    })

    it('should use default rebalancing percentage if not configured', async () => {
      ecoConfigService.getLiquidityManager.mockReturnValue({
        targetSlippage: 0.02,
        maxQuoteSlippage: 0.05,
        intervalDuration: 300000,
        thresholds: {
          surplus: 0.1,
          deficit: 0.1,
        },
        walletStrategies: {},
        coreTokens: [],
      })

      const swapAmount = 100
      const quote = await service.getQuote(mockTokenIn, mockTokenOut, swapAmount)

      expect(quote.amountOut).toBe(parseUnits('95', 18)) // Default 5%
      expect(quote.context.rebalancingPercentage).toBe(0.05)
    })
  })

  describe('execute', () => {
    const mockQuote: RebalanceQuote<'NegativeIntent'> = {
      amountIn: parseUnits('100', 18),
      amountOut: parseUnits('95', 18),
      slippage: 0.05,
      tokenIn: mockTokenIn,
      tokenOut: mockTokenOut,
      strategy: 'NegativeIntent',
      context: {
        intentHash: '0x' as Hex,
        rebalancingPercentage: 0.05,
      },
      id: 'quote-id-1',
    }

    const mockIntentSource = {
      network: 'mainnet' as any,
      chainID: 1,
      sourceAddress: '0xIntentSource' as Hex,
      inbox: '0xInbox' as Hex,
      tokens: ['0xToken1' as Hex],
      provers: ['0xProver1' as Hex],
    }

    beforeEach(() => {
      ecoConfigService.getIntentSources.mockReturnValue([mockIntentSource])
      kernelAccountClientService.getClient.mockResolvedValue(mockKernelClient as any)
      walletClientDefaultSignerService.getClient.mockResolvedValue(mockWalletClient as any)
      publicClient.getClient.mockResolvedValue(mockPublicClient as any)

      mockKernelClient.writeContract.mockResolvedValue('0xPublishTxHash' as Hex)
      mockKernelClient.waitForTransactionReceipt.mockResolvedValue({ status: 'success' })

      mockWalletClient.writeContract.mockResolvedValue('0xWithdrawTxHash' as Hex)
      mockWalletClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
      })

      mockPublicClient.getBlock.mockResolvedValue({ baseFeePerGas: 1000n })
      mockPublicClient.estimateMaxPriorityFeePerGas.mockResolvedValue(100n)
      mockPublicClient.getTransactionCount.mockResolvedValue(10)

      litActionService.executeNegativeIntentRebalanceAction.mockResolvedValue(
        '0xFulfillTxHash' as Hex,
      )
      ;(hashIntent as jest.Mock).mockReturnValue({ intentHash: '0xIntentHash' as Hex })
    })

    it('should throw error if not executed by crowd liquidity pool', async () => {
      await expect(service.execute('0xOtherWallet', mockQuote)).rejects.toThrow(
        'Rebalancing intents can only be executed by the crowd liquidity pool',
      )
    })

    it('should successfully execute negative intent rebalance', async () => {
      const crowdLiquidityPoolAddress = '0x1234567890123456789012345678901234567890'

      await service.execute(crowdLiquidityPoolAddress, mockQuote)

      // Verify intent was published
      expect(mockKernelClient.writeContract).toHaveBeenCalledWith({
        address: mockIntentSource.sourceAddress,
        abi: IntentSourceAbi,
        functionName: 'publishAndFund',
        args: expect.arrayContaining([
          expect.objectContaining({
            route: expect.objectContaining({
              source: 1n,
              destination: 137n,
              tokens: [{ token: mockTokenIn.config.address, amount: mockQuote.amountIn }],
            }),
            reward: expect.objectContaining({
              tokens: [{ token: mockTokenOut.config.address, amount: mockQuote.amountOut }],
            }),
          }),
          false,
        ]),
        value: 0n,
        chain: mockKernelClient.chain,
        account: mockKernelClient.kernelAccount,
      })

      // Verify Lit action was triggered
      expect(litActionService.executeNegativeIntentRebalanceAction).toHaveBeenCalledWith(
        '0xIntentHash',
        '0xPublicKey',
        crowdLiquidityPoolAddress,
        expect.objectContaining({
          type: 2,
          nonce: 10,
          gasLimit: 1_000_000,
        }),
        mockPublicClient,
      )

      // Verify monitoring was started
      expect(negativeIntentMonitorService.monitorNegativeIntent).toHaveBeenCalledWith(
        '0xIntentHash',
        mockTokenIn.chainId,
        mockTokenOut.chainId,
        '0xFulfillTxHash',
      )

      // Verify withdrawal was executed
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: mockIntentSource.sourceAddress,
        abi: IntentSourceAbi,
        functionName: 'withdrawRewards',
        args: expect.any(Array),
      })
    })

    it('should throw error if amountOut >= amountIn', async () => {
      const invalidQuote = {
        ...mockQuote,
        amountOut: mockQuote.amountIn,
      }

      await expect(
        service.execute('0x1234567890123456789012345678901234567890', invalidQuote),
      ).rejects.toThrow('Rebalancing intent must have amountOut < amountIn')
    })

    it('should throw error if no intent source found', async () => {
      ecoConfigService.getIntentSources.mockReturnValue([])

      await expect(
        service.execute('0x1234567890123456789012345678901234567890', mockQuote),
      ).rejects.toThrow('No intent source found for chain 1')
    })

    it('should handle withdrawal transaction failure', async () => {
      mockWalletClient.waitForTransactionReceipt.mockResolvedValue({ status: 'failure' })

      await expect(
        service.execute('0x1234567890123456789012345678901234567890', mockQuote),
      ).rejects.toThrow('Withdrawal transaction failed')
    })

    it('should handle Lit action execution failure', async () => {
      const error = new Error('Lit action failed')
      litActionService.executeNegativeIntentRebalanceAction.mockRejectedValue(error)

      await expect(
        service.execute('0x1234567890123456789012345678901234567890', mockQuote),
      ).rejects.toThrow('Lit action failed')
    })
  })
})
