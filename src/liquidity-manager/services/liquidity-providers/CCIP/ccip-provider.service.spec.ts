import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Queue } from 'bullmq'
import { Hex, parseUnits } from 'viem'
import { CCIPProviderService } from './ccip-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { CCIPConfig } from '@/eco-configs/eco-config.types'
import { TokenData, RebalanceQuote } from '@/liquidity-manager/types/types'
import { EcoError } from '@/common/errors/eco-error'
import { TRANSFER_STATUS_FROM_BLOCK_SHIFT } from '@/liquidity-manager/services/liquidity-providers/CCIP/ccip-abis'

const mockCcipClient = {
  getFee: jest.fn(),
  getOnRampAddress: jest.fn(),
  getTransferStatus: jest.fn(),
}

jest.mock('@/liquidity-manager/services/liquidity-providers/CCIP/ccip-client', () => ({
  createClient: jest.fn(() => mockCcipClient),
  TransferStatus: {
    Success: 'Success',
    Failure: 'Failure',
    InProgress: 'InProgress',
  },
}))

describe('CCIPProviderService', () => {
  let service: CCIPProviderService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let publicClientService: DeepMocked<MultichainPublicClientService>
  let kernelAccountClientService: DeepMocked<LmTxGatedKernelAccountClientService>
  let rebalanceRepository: DeepMocked<RebalanceRepository>

  const WALLET_ADDRESS = '0x1111111111111111111111111111111111111111' as Hex
  const FEE_TOKEN_ADDRESS = '0x2222222222222222222222222222222222222222'
  const SOURCE_TOKEN_ADDRESS = '0x3333333333333333333333333333333333333333'
  const DEST_TOKEN_ADDRESS = '0x4444444444444444444444444444444444444444'

  const tokenIn: TokenData = {
    chainId: 1,
    config: {
      chainId: 1,
      address: SOURCE_TOKEN_ADDRESS,
      type: 'erc20',
      minBalance: 0,
      targetBalance: 0,
    },
    balance: {
      address: SOURCE_TOKEN_ADDRESS,
      decimals: 6,
      balance: 1_000_000n,
    },
  } as TokenData

  const tokenOut: TokenData = {
    chainId: 2,
    config: {
      chainId: 2,
      address: DEST_TOKEN_ADDRESS,
      type: 'erc20',
      minBalance: 0,
      targetBalance: 0,
    },
    balance: {
      address: DEST_TOKEN_ADDRESS,
      decimals: 6,
      balance: 1_000_000n,
    },
  } as TokenData

  const baseConfig: CCIPConfig = {
    enabled: true,
    chains: [
      {
        chainId: 1,
        chainSelector: '100',
        router: '0x5555555555555555555555555555555555555555',
        tokens: {
          USDC: {
            symbol: 'USDC',
            address: SOURCE_TOKEN_ADDRESS,
            decimals: 6,
            tokenPool: '0x6666666666666666666666666666666666666666',
          },
        },
        supportsNativeFee: true,
      },
      {
        chainId: 2,
        chainSelector: '200',
        router: '0x7777777777777777777777777777777777777777',
        tokens: {
          USDC: {
            symbol: 'USDC',
            address: DEST_TOKEN_ADDRESS,
            decimals: 6,
            tokenPool: '0x8888888888888888888888888888888888888888',
          },
        },
        supportsNativeFee: true,
      },
    ],
    delivery: {
      backoffMs: 10_000,
      maxAttempts: 5,
    },
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    mockCcipClient.getFee.mockResolvedValue(100n)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CCIPProviderService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: MultichainPublicClientService,
          useValue: createMock<MultichainPublicClientService>(),
        },
        {
          provide: LmTxGatedKernelAccountClientService,
          useValue: createMock<LmTxGatedKernelAccountClientService>(),
        },
        { provide: RebalanceRepository, useValue: createMock<RebalanceRepository>() },
        { provide: getQueueToken(LiquidityManagerQueue.queueName), useValue: createMock<Queue>() },
      ],
    }).compile()

    service = module.get(CCIPProviderService)
    ecoConfigService = module.get(EcoConfigService)
    publicClientService = module.get(MultichainPublicClientService)
    kernelAccountClientService = module.get(LmTxGatedKernelAccountClientService)
    rebalanceRepository = module.get(RebalanceRepository)

    service['liquidityManagerQueue'] = {
      startCCIPDeliveryCheck: jest.fn(),
    } as unknown as LiquidityManagerQueue

    ecoConfigService.getCCIP.mockReturnValue(baseConfig)
    const publicClient = { getBlockNumber: jest.fn().mockResolvedValue(500n) }
    publicClientService.getClient.mockResolvedValue(publicClient as any)
    kernelAccountClientService.getAddress.mockResolvedValue(WALLET_ADDRESS)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('returns CCIP strategy identifier', () => {
    expect(service.getStrategy()).toBe('CCIP')
  })

  describe('getQuote', () => {
    it('builds a quote with native fee defaults', async () => {
      const quote = await service.getQuote(tokenIn, tokenOut, 10, 'quote-id')

      expect(quote.amountIn).toEqual(parseUnits('10', 6))
      expect(quote.amountOut).toEqual(parseUnits('10', 6))
      expect(quote.context.router).toBe(baseConfig.chains[0].router)
      expect(quote.context.feeTokenAddress).toBeUndefined()
      expect(mockCcipClient.getFee).toHaveBeenCalledWith(
        expect.objectContaining({
          routerAddress: baseConfig.chains[0].router,
          destinationChainSelector: baseConfig.chains[1].chainSelector,
          tokenAddress: SOURCE_TOKEN_ADDRESS,
        }),
      )
    })

    it('honors configured ERC20 fee token when native fees are disabled', async () => {
      const feeConfig: CCIPConfig = {
        ...baseConfig,
        chains: [
          {
            ...baseConfig.chains[0],
            supportsNativeFee: false,
            feeToken: {
              symbol: 'LINK',
              address: FEE_TOKEN_ADDRESS,
              decimals: 18,
            },
          },
          baseConfig.chains[1],
        ],
      }
      ecoConfigService.getCCIP.mockReturnValue(feeConfig)

      const quote = await service.getQuote(tokenIn, tokenOut, 10, 'quote-id')

      expect(quote.context.feeTokenAddress).toBe(FEE_TOKEN_ADDRESS)
      expect(quote.context.feeTokenSymbol).toBe('LINK')
    })

    it('throws when provider is disabled', async () => {
      ecoConfigService.getCCIP.mockReturnValue({ ...baseConfig, enabled: false })
      await expect(service.getQuote(tokenIn, tokenOut, 10)).rejects.toThrow(
        'CCIP provider disabled',
      )
    })

    it('throws when attempting a same-chain route', async () => {
      await expect(service.getQuote(tokenIn, tokenIn, 10)).rejects.toThrow(
        'CCIP same-chain routes are not supported',
      )
    })
  })

  describe('execute', () => {
    it('submits router transactions and enqueues delivery check', async () => {
      const quote = await service.getQuote(tokenIn, tokenOut, 10)
      quote.groupID = 'group-1'
      quote.rebalanceJobID = 'rebalance-1'

      const kernelClient = {
        execute: jest.fn().mockResolvedValue('0xdeadbeef' as Hex),
        waitForTransactionReceipt: jest.fn().mockResolvedValue({} as any),
      }

      kernelAccountClientService.getClient.mockResolvedValue(kernelClient as any)

      const allowanceSpy = jest
        .spyOn(service as any, 'hasSufficientAllowance')
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true)
      const feeSpy = jest.spyOn(service as any, 'computeFee').mockResolvedValue(200n)
      const messageIdSpy = jest
        .spyOn(service as any, 'extractMessageId')
        .mockResolvedValue('0xmessage' as Hex)

      const result = await service.execute(WALLET_ADDRESS, quote as RebalanceQuote<'CCIP'>)

      expect(result).toBe('0xdeadbeef')
      expect(allowanceSpy).toHaveBeenCalled()
      expect(feeSpy).toHaveBeenCalled()
      expect(kernelClient.execute).toHaveBeenCalledTimes(1)
      expect((service['liquidityManagerQueue'] as any).startCCIPDeliveryCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: '0xmessage',
          sourceChainId: tokenIn.chainId,
          destinationChainId: tokenOut.chainId,
          fromBlockNumber: (500n - TRANSFER_STATUS_FROM_BLOCK_SHIFT).toString(),
        }),
      )
      expect(messageIdSpy).toHaveBeenCalled()
    })

    it('marks rebalance as failed when execution throws', async () => {
      const quote = await service.getQuote(tokenIn, tokenOut, 10)
      quote.groupID = 'group-err'
      quote.rebalanceJobID = 'rebalance-1'

      kernelAccountClientService.getClient.mockRejectedValue(new Error('kernel error'))

      await expect(
        service.execute(WALLET_ADDRESS, quote as RebalanceQuote<'CCIP'>),
      ).rejects.toThrow('kernel error')

      expect(rebalanceRepository.updateStatus).toHaveBeenCalledWith(
        'rebalance-1',
        expect.anything(),
      )
    })

    it('adds fee token approval when native fees are disabled', async () => {
      const feeConfig: CCIPConfig = {
        ...baseConfig,
        chains: [
          {
            ...baseConfig.chains[0],
            supportsNativeFee: false,
            feeToken: {
              symbol: 'LINK',
              address: FEE_TOKEN_ADDRESS,
              decimals: 18,
            },
          },
          baseConfig.chains[1],
        ],
      }
      ecoConfigService.getCCIP.mockReturnValue(feeConfig)

      const quote = await service.getQuote(tokenIn, tokenOut, 10)
      quote.groupID = 'group-2'
      quote.rebalanceJobID = 'rebalance-2'

      const kernelClient = {
        execute: jest.fn().mockResolvedValue('0xbeadfeed' as Hex),
        waitForTransactionReceipt: jest.fn().mockResolvedValue({} as any),
      }
      kernelAccountClientService.getClient.mockResolvedValue(kernelClient as any)

      const allowanceSpy = jest
        .spyOn(service as any, 'hasSufficientAllowance')
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true)
      jest.spyOn(service as any, 'computeFee').mockResolvedValue(500n)
      jest.spyOn(service as any, 'extractMessageId').mockResolvedValue('0xfee-message' as Hex)

      await service.execute(WALLET_ADDRESS, quote as RebalanceQuote<'CCIP'>)

      expect(allowanceSpy).toHaveBeenCalledTimes(2)
      expect(allowanceSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ tokenAddress: quote.context.tokenAddress }),
      )
      expect(allowanceSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ tokenAddress: quote.context.feeTokenAddress }),
      )
      const executeCalls = kernelClient.execute.mock.calls[0][0]
      expect(executeCalls).toHaveLength(3)
      expect(executeCalls[0].to).toBe(quote.context.tokenAddress)
      expect(executeCalls[1].to).toBe(quote.context.feeTokenAddress)
    })
  })
})
