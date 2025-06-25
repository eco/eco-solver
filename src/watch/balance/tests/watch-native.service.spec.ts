import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { WatchNativeService } from '../watch-native.service'
import { Queue } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { QUEUES } from '@/common/redis/constants'
import { Solver } from '@/eco-configs/eco-config.types'
import { PublicClient, Hex, Block, Transaction } from 'viem'
import { Network } from '@/common/alchemy/network'

describe('WatchNativeService', () => {
  let service: WatchNativeService
  let mockQueue: DeepMocked<Queue>
  let mockPublicClientService: DeepMocked<MultichainPublicClientService>
  let mockEcoConfigService: DeepMocked<EcoConfigService>
  let mockKernelAccountClientService: DeepMocked<KernelAccountClientService>
  let mockPublicClient: DeepMocked<PublicClient>

  const mockEOCAddress = '0x1234567890123456789012345678901234567890' as Hex
  const mockFromAddress = '0x1111111111111111111111111111111111111111' as Hex
  const mockToAddress = '0x9876543210987654321098765432109876543210' as Hex

  const mockSolver: Solver = {
    chainID: 1,
    network: Network.ETH_MAINNET,
    inboxAddress: '0x1111111111111111111111111111111111111111' as Hex,
    fee: {
      limit: {
        tokenBase6: 1000000n,
        nativeBase18: 1000000000000000000n,
      },
      algorithm: 'linear' as const,
      constants: {
        token: {
          baseFee: 1000000n,
          tranche: { unitFee: 1000000n, unitSize: 1000000n },
        },
        native: {
          baseFee: 1000000n,
          tranche: { unitFee: 1000000n, unitSize: 1000000000000000000n },
        },
      },
    },
    nativeMax: 1000000000000000000n,
    averageBlockTime: 12000,
    targets: {
      ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex]: {
        contractType: 'erc20',
        selectors: ['0x12345678'],
        minBalance: 1000000,
        targetBalance: 10000000,
        maxBalance: 100000000,
      },
    },
  }

  const mockSolvers = {
    1: mockSolver,
  }

  const mockTransaction: Transaction = {
    hash: '0x0987654321987654321987654321987654321987654321987654321987654321' as Hex,
    from: mockFromAddress,
    to: mockEOCAddress,
    value: 1000000000000000000n, // 1 ETH
    blockHash: '0xabcdef123456abcdef123456abcdef123456abcdef123456abcdef123456abcdef12' as Hex,
    blockNumber: 18500000n,
    gas: 21000n,
    gasPrice: 20000000000n,
    input: '0x' as Hex,
    nonce: 1,
    transactionIndex: 0,
    type: 'legacy',
  } as Transaction

  const mockBlock: Block = {
    number: 18500000n,
    hash: '0xabcdef123456abcdef123456abcdef123456abcdef123456abcdef123456abcdef12' as Hex,
    parentHash: '0xparent123456parent123456parent123456parent123456parent123456parent123456' as Hex,
    timestamp: 1696000000n,
    transactions: [mockTransaction],
  } as Block

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchNativeService,
        {
          provide: getQueueToken(QUEUES.BALANCE_MONITOR.queue),
          useValue: createMock<Queue>(),
        },
        {
          provide: MultichainPublicClientService,
          useValue: createMock<MultichainPublicClientService>(),
        },
        {
          provide: EcoConfigService,
          useValue: createMock<EcoConfigService>(),
        },
        {
          provide: KernelAccountClientService,
          useValue: createMock<KernelAccountClientService>(),
        },
      ],
    }).compile()

    service = module.get<WatchNativeService>(WatchNativeService)
    mockQueue = module.get(getQueueToken(QUEUES.BALANCE_MONITOR.queue))
    mockPublicClientService = module.get(MultichainPublicClientService)
    mockEcoConfigService = module.get(EcoConfigService)
    mockKernelAccountClientService = module.get(KernelAccountClientService)

    // Create mock public client
    mockPublicClient = createMock<PublicClient>()
    mockPublicClient.watchBlocks.mockReturnValue(jest.fn())

    // Setup default mocks
    mockPublicClientService.getClient.mockResolvedValue(mockPublicClient)
    mockEcoConfigService.getSolvers.mockReturnValue(mockSolvers)
    mockKernelAccountClientService.getClient.mockResolvedValue({
      account: { address: mockEOCAddress },
    } as any)

    jest.clearAllMocks()
  })

  describe('subscribe', () => {
    it('should successfully subscribe to all solvers', async () => {
      await service.subscribe()

      expect(mockEcoConfigService.getSolvers).toHaveBeenCalled()
      expect(mockPublicClientService.getClient).toHaveBeenCalledWith(1)
      expect(mockKernelAccountClientService.getClient).toHaveBeenCalledWith(1)
    })

    it('should handle errors during subscription gracefully', async () => {
      mockPublicClientService.getClient.mockRejectedValue(new Error('Connection failed'))

      await expect(service.subscribe()).resolves.not.toThrow()
      expect(mockEcoConfigService.getSolvers).toHaveBeenCalled()
      expect(mockPublicClientService.getClient).toHaveBeenCalledWith(1)
    })

    it('should handle multiple solvers', async () => {
      const multipleSolvers = {
        1: mockSolver,
        137: { ...mockSolver, chainID: 137, network: Network.MATIC_MAINNET },
      }
      mockEcoConfigService.getSolvers.mockReturnValue(multipleSolvers)

      await service.subscribe()

      expect(mockPublicClientService.getClient).toHaveBeenCalledWith(1)
      expect(mockPublicClientService.getClient).toHaveBeenCalledWith(137)
    })
  })

  describe('subscribeTo', () => {
    it('should subscribe to block events for native transfers', async () => {
      await service.subscribeTo(mockPublicClient, mockSolver)

      expect(mockKernelAccountClientService.getClient).toHaveBeenCalledWith(1)
      expect(mockPublicClient.watchBlocks).toHaveBeenCalledWith(
        expect.objectContaining({
          includeTransactions: true,
          onBlock: expect.any(Function),
          onError: expect.any(Function),
        }),
      )
    })

    it('should skip subscription if no EOC address found', async () => {
      mockKernelAccountClientService.getClient.mockResolvedValue({
        account: null,
      } as any)

      await service.subscribeTo(mockPublicClient, mockSolver)

      expect(mockPublicClient.watchBlocks).not.toHaveBeenCalled()
    })

    it('should handle kernel client errors gracefully', async () => {
      mockKernelAccountClientService.getClient.mockRejectedValue(new Error('Kernel client error'))

      await service.subscribeTo(mockPublicClient, mockSolver)

      expect(mockPublicClient.watchBlocks).not.toHaveBeenCalled()
    })
  })

  describe('processBlock', () => {
    it('should process incoming native transfers', async () => {
      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(mockBlock, mockSolver, mockEOCAddress)

      expect(mockQueue.add).toHaveBeenCalledWith(
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          chainId: '1',
          address: 'native',
          changeAmount: '1000000000000000000',
          direction: 'incoming',
          blockNumber: '18500000',
          blockHash: '0xabcdef123456abcdef123456abcdef123456abcdef123456abcdef123456abcdef12',
          transactionHash: '0x0987654321987654321987654321987654321987654321987654321987654321',
          from: mockFromAddress,
          to: mockEOCAddress,
        }),
        expect.objectContaining({
          jobId: expect.stringContaining('watch-native-balance-change'),
        }),
      )
    })

    it('should process outgoing native transfers', async () => {
      const outgoingTransaction = {
        ...mockTransaction,
        from: mockEOCAddress,
        to: mockToAddress,
      }
      const blockWithOutgoingTx = {
        ...mockBlock,
        transactions: [outgoingTransaction],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithOutgoingTx, mockSolver, mockEOCAddress)

      expect(mockQueue.add).toHaveBeenCalledWith(
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          direction: 'outgoing',
          from: mockEOCAddress,
          to: mockToAddress,
        }),
        expect.any(Object),
      )
    })

    it('should ignore transactions with zero value', async () => {
      const zeroValueTransaction = {
        ...mockTransaction,
        value: 0n,
      }
      const blockWithZeroValueTx = {
        ...mockBlock,
        transactions: [zeroValueTransaction],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithZeroValueTx, mockSolver, mockEOCAddress)

      expect(mockQueue.add).not.toHaveBeenCalled()
    })

    it('should ignore transactions without to or from addresses', async () => {
      const transactionWithoutTo = {
        ...mockTransaction,
        to: null,
      }
      const transactionWithoutFrom = {
        ...mockTransaction,
        from: null,
      }
      const blockWithInvalidTxs = {
        ...mockBlock,
        transactions: [transactionWithoutTo, transactionWithoutFrom],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithInvalidTxs, mockSolver, mockEOCAddress)

      expect(mockQueue.add).not.toHaveBeenCalled()
    })

    it('should ignore transactions not involving the solver', async () => {
      const unrelatedTransaction = {
        ...mockTransaction,
        from: mockFromAddress,
        to: mockToAddress, // Neither from nor to is the solver address
      }
      const blockWithUnrelatedTx = {
        ...mockBlock,
        transactions: [unrelatedTransaction],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithUnrelatedTx, mockSolver, mockEOCAddress)

      expect(mockQueue.add).not.toHaveBeenCalled()
    })

    it('should handle multiple relevant transactions in a block', async () => {
      const incomingTransaction = mockTransaction
      const outgoingTransaction = {
        ...mockTransaction,
        hash: '0x111111111' as Hex,
        from: mockEOCAddress,
        to: mockToAddress,
        value: 2000000000000000000n, // 2 ETH
      }
      const blockWithMultipleTxs = {
        ...mockBlock,
        transactions: [incomingTransaction, outgoingTransaction],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithMultipleTxs, mockSolver, mockEOCAddress)

      expect(mockQueue.add).toHaveBeenCalledTimes(2)
      expect(mockQueue.add).toHaveBeenNthCalledWith(
        1,
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          direction: 'incoming',
          changeAmount: '1000000000000000000',
        }),
        expect.any(Object),
      )
      expect(mockQueue.add).toHaveBeenNthCalledWith(
        2,
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          direction: 'outgoing',
          changeAmount: '2000000000000000000',
        }),
        expect.any(Object),
      )
    })

    it('should handle blocks with string transactions (tx hashes only)', async () => {
      const blockWithStringTxs = {
        ...mockBlock,
        transactions: ['0x123456789', '0x987654321'] as any[],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithStringTxs, mockSolver, mockEOCAddress)

      expect(mockQueue.add).not.toHaveBeenCalled()
    })

    it('should handle errors during block processing gracefully', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'))

      const processBlockMethod = (service as any).processBlock.bind(service)
      await expect(processBlockMethod(mockBlock, mockSolver, mockEOCAddress)).resolves.not.toThrow()
    })

    it('should handle large transfer amounts correctly', async () => {
      const largeValueTransaction = {
        ...mockTransaction,
        value: BigInt('999999999999999999999999'), // Very large amount
      }
      const blockWithLargeTx = {
        ...mockBlock,
        transactions: [largeValueTransaction],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithLargeTx, mockSolver, mockEOCAddress)

      expect(mockQueue.add).toHaveBeenCalledWith(
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          changeAmount: '999999999999999999999999',
        }),
        expect.any(Object),
      )
    })
  })

  describe('getEOCAddress', () => {
    it('should return EOC address when available', async () => {
      const result = await (service as any).getEOCAddress(mockSolver)

      expect(result).toBe(mockEOCAddress)
      expect(mockKernelAccountClientService.getClient).toHaveBeenCalledWith(1)
    })

    it('should return null when account is not available', async () => {
      mockKernelAccountClientService.getClient.mockResolvedValue({
        account: null,
      } as any)

      const result = await (service as any).getEOCAddress(mockSolver)

      expect(result).toBeNull()
    })

    it('should return null when account address is undefined', async () => {
      mockKernelAccountClientService.getClient.mockResolvedValue({
        account: { address: undefined },
      } as any)

      const result = await (service as any).getEOCAddress(mockSolver)

      expect(result).toBeNull()
    })

    it('should handle kernel client service errors', async () => {
      mockKernelAccountClientService.getClient.mockRejectedValue(new Error('Kernel service error'))

      const result = await (service as any).getEOCAddress(mockSolver)

      expect(result).toBeNull()
    })
  })

  describe('addJob (interface compliance)', () => {
    it('should implement addJob method for interface compliance but not process logs', async () => {
      const addJobFunction = service.addJob(mockSolver)
      await addJobFunction([])

      // This method should not add any jobs since it's not used for native transfers
      expect(mockQueue.add).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle watch block errors via onError callback', async () => {
      let onErrorCallback: (error: Error) => Promise<void>

      mockPublicClient.watchBlocks.mockImplementation((options: any) => {
        onErrorCallback = options.onError
        return jest.fn()
      })

      await service.subscribeTo(mockPublicClient, mockSolver)

      // Simulate an error
      const error = new Error('WebSocket connection lost')
      await expect(onErrorCallback!(error)).resolves.not.toThrow()
    })

    it('should handle address normalization correctly', async () => {
      // Test with different case addresses
      const mixedCaseEOC = '0x1234567890123456789012345678901234567890' as Hex
      const mixedCaseFrom = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12' as Hex

      const transactionWithMixedCase = {
        ...mockTransaction,
        from: mixedCaseFrom,
        to: mixedCaseEOC.toLowerCase() as Hex,
      }
      const blockWithMixedCase = {
        ...mockBlock,
        transactions: [transactionWithMixedCase],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithMixedCase, mockSolver, mixedCaseEOC)

      expect(mockQueue.add).toHaveBeenCalledWith(
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          direction: 'incoming',
        }),
        expect.any(Object),
      )
    })
  })

  describe('integration scenarios', () => {
    it('should handle a complete native transfer monitoring workflow', async () => {
      // Subscribe to events
      await service.subscribe()

      // Verify subscription setup
      expect(mockPublicClient.watchBlocks).toHaveBeenCalledTimes(1)

      // Get the onBlock callback
      const onBlockCallback = (mockPublicClient.watchBlocks as jest.Mock).mock.calls[0][0].onBlock

      // Simulate receiving a block with native transfers
      await onBlockCallback(mockBlock)

      // Verify job was created
      expect(mockQueue.add).toHaveBeenCalledWith(
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          chainId: '1',
          address: 'native',
          direction: 'incoming',
        }),
        expect.any(Object),
      )
    })

    it('should handle blocks with no relevant transactions', async () => {
      const blockWithNoRelevantTxs = {
        ...mockBlock,
        transactions: [
          {
            ...mockTransaction,
            from: mockFromAddress,
            to: mockToAddress,
            value: 0n, // Zero value
          },
        ],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithNoRelevantTxs, mockSolver, mockEOCAddress)

      expect(mockQueue.add).not.toHaveBeenCalled()
    })

    it('should generate unique job IDs for different transactions', async () => {
      const transaction1 = mockTransaction
      const transaction2 = {
        ...mockTransaction,
        hash: '0x111111111' as Hex,
        value: 2000000000000000000n,
      }
      const blockWithMultipleTxs = {
        ...mockBlock,
        transactions: [transaction1, transaction2],
      }

      const processBlockMethod = (service as any).processBlock.bind(service)
      await processBlockMethod(blockWithMultipleTxs, mockSolver, mockEOCAddress)

      expect(mockQueue.add).toHaveBeenCalledTimes(2)

      const firstCallJobId = (mockQueue.add as jest.Mock).mock.calls[0][2].jobId
      const secondCallJobId = (mockQueue.add as jest.Mock).mock.calls[1][2].jobId

      expect(firstCallJobId).not.toEqual(secondCallJobId)
      expect(firstCallJobId).toContain('watch-native-balance-change')
      expect(secondCallJobId).toContain('watch-native-balance-change')
    })
  })
})
