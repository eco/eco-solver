import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { parseUnits, Hex } from 'viem'
import { CCTPV2ProviderService } from './cctpv2-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { TokenData, RebalanceQuote } from '@/liquidity-manager/types/types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { Queue } from 'bullmq'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'
import { LmTxGatedWalletClientService } from '@/liquidity-manager/wallet-wrappers/wallet-gated-client.service'

const CCTPV2_FINALITY_THRESHOLD_FAST = 1000
const CCTPV2_FINALITY_THRESHOLD_STANDARD = 2000

// Mock global fetch
global.fetch = jest.fn()

describe('CCTPV2ProviderService', () => {
  let service: CCTPV2ProviderService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let kernelAccountClientService: DeepMocked<LmTxGatedKernelAccountClientService>
  let walletClientService: DeepMocked<LmTxGatedWalletClientService>
  let queue: DeepMocked<Queue>

  const mockTokenIn: TokenData = {
    chainId: 1,
    config: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: 1, type: 'erc20' },
    balance: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      balance: 10000000n,
    },
  } as any

  const mockTokenOut: TokenData = {
    chainId: 10,
    config: { address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', chainId: 10, type: 'erc20' },
    balance: { address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', decimals: 6, balance: 0n },
  } as any

  const mockV2Config = {
    apiUrl: 'https://test-api.circle.com',
    fastTransferEnabled: true,
    chains: [
      {
        chainId: 1,
        domain: 0,
        token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        tokenMessenger: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962', // Placeholder valid address
        messageTransmitter: '0xAD09780d193884d503182aD4588450C416D6F9D4', // Placeholder valid address
      },
      {
        chainId: 10,
        domain: 2,
        token: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
        tokenMessenger: '0x19330d10D9Cc8751218eaf51E8885D058642E08A', // Placeholder valid address
        messageTransmitter: '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca', // Placeholder valid address
      },
    ],
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CCTPV2ProviderService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: LmTxGatedKernelAccountClientService,
          useValue: createMock<LmTxGatedKernelAccountClientService>(),
        },
        {
          provide: LmTxGatedWalletClientService,
          useValue: createMock<LmTxGatedWalletClientService>(),
        },
        { provide: RebalanceRepository, useValue: createMock<RebalanceRepository>() },
        { provide: getQueueToken(LiquidityManagerQueue.queueName), useValue: createMock<Queue>() },
      ],
    }).compile()

    service = module.get<CCTPV2ProviderService>(CCTPV2ProviderService)
    ecoConfigService = module.get(EcoConfigService)
    kernelAccountClientService = module.get(LmTxGatedKernelAccountClientService)
    walletClientService = module.get(LmTxGatedWalletClientService)
    queue = module.get(getQueueToken(LiquidityManagerQueue.queueName))
    service['liquidityManagerQueue'] = new LiquidityManagerQueue(queue as any)

    ecoConfigService.getCCTPV2.mockReturnValue(mockV2Config as any)
    service['config'] = mockV2Config as any
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return the correct strategy', () => {
    expect(service.getStrategy()).toBe('CCTPV2')
  })

  describe('getQuote', () => {
    it('should prioritize fast transfer when enabled and available', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { finalityThreshold: CCTPV2_FINALITY_THRESHOLD_FAST, minimumFee: 10 }, // 0.1% fee
            { finalityThreshold: CCTPV2_FINALITY_THRESHOLD_STANDARD, minimumFee: 0 },
          ]),
      })

      const quotes = await service.getQuote(mockTokenIn, mockTokenOut, 10)
      expect(quotes).toHaveLength(1)
      expect(quotes[0].context.transferType).toBe('fast')
      expect(quotes[0].context.feeBps).toBe(10)
      expect(quotes[0].context.minFinalityThreshold).toBe(CCTPV2_FINALITY_THRESHOLD_FAST)
      expect(quotes[0].slippage).toBe(0.1)
    })

    it('should fallback to standard transfer if fast transfer is disabled', async () => {
      service['config'].fastTransferEnabled = false
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { finalityThreshold: CCTPV2_FINALITY_THRESHOLD_FAST, minimumFee: 10 },
            { finalityThreshold: CCTPV2_FINALITY_THRESHOLD_STANDARD, minimumFee: 0 },
          ]),
      })

      const quotes = await service.getQuote(mockTokenIn, mockTokenOut, 10)
      expect(quotes).toHaveLength(1)
      expect(quotes[0].context.transferType).toBe('standard')
      expect(quotes[0].context.feeBps).toBe(0)
    })

    it('should return default standard quote if API fails', async () => {
      ;(fetch as jest.Mock).mockRejectedValue(new Error('API Down'))
      const quotes = await service.getQuote(mockTokenIn, mockTokenOut, 10)
      expect(quotes).toHaveLength(1)
      expect(quotes[0].context.transferType).toBe('standard')
      expect(quotes[0].context.fee).toBe(0n)
    })

    it('should throw an error for unsupported routes', async () => {
      const unsupportedToken = {
        ...mockTokenOut,
        config: { ...mockTokenOut.config, chainId: 999 },
        chainId: 999,
      }
      console.log(unsupportedToken)
      await expect(service.getQuote(mockTokenIn, unsupportedToken, 10)).rejects.toThrow(
        'Unsupported route for CCTP V2',
      )
    })
  })

  describe('execute', () => {
    it('should execute a transfer and queue an attestation check', async () => {
      const mockQuote: RebalanceQuote<'CCTPV2'> = {
        amountIn: parseUnits('10', 6),
        amountOut: parseUnits('9.99', 6),
        slippage: 0.001,
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        strategy: 'CCTPV2',
        context: {
          transferType: 'fast',
          fee: parseUnits('0.01', 6),
          feeBps: 10,
          minFinalityThreshold: CCTPV2_FINALITY_THRESHOLD_FAST,
        },
        id: 'test-id',
      }
      const mockTxHash = '0x123' as Hex
      const mockClient = {
        execute: jest.fn().mockResolvedValue(mockTxHash),
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)
      queue.add = jest.fn().mockResolvedValue({}) // Explicitly mock the 'add' method

      const result = await service.execute('0xWallet', mockQuote)

      expect(result).toBe(mockTxHash)
      expect(mockClient.execute).toHaveBeenCalledTimes(1)
      expect(queue.add).toHaveBeenCalledWith(
        'CHECK_CCTPV2_ATTESTATION',
        expect.objectContaining({
          transactionHash: mockTxHash,
          sourceDomain: 0,
        }),
        expect.any(Object),
      )
    })
  })

  describe('fetchV2Attestation', () => {
    it('should return complete status when attestation is found', async () => {
      const mockApiResponse = {
        messages: [
          {
            message: '0xmessageBody',
            attestation: '0xattestation',
            status: 'complete',
          },
        ],
      }
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const result = await service.fetchV2Attestation('0xTxHash', 0)
      expect(result.status).toBe('complete')
      expect(result).toHaveProperty('messageBody', '0xmessageBody')
      expect(result).toHaveProperty('attestation', '0xattestation')
    })

    it('should return pending status when no message is found', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: [] }),
      })

      const result = await service.fetchV2Attestation('0xTxHash', 0)
      expect(result.status).toBe('pending')
    })
  })

  describe('receiveV2Message', () => {
    it('should call writeContract on the wallet client', async () => {
      const mockTxHash = '0x456' as Hex
      const mockClient = {
        writeContract: jest.fn().mockResolvedValue(mockTxHash),
        waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
      }
      walletClientService.getClient.mockResolvedValue(mockClient as any)
      walletClientService.getPublicClient.mockResolvedValue(mockClient as any)

      const result = await service.receiveV2Message(
        10,
        '0xmessageBody' as Hex,
        '0xattestation' as Hex,
      )

      expect(result).toBe(mockTxHash)
      expect(mockClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockV2Config.chains[1].messageTransmitter,
          functionName: 'receiveMessage',
        }),
      )
    })
  })
})
