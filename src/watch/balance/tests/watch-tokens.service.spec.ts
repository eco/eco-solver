import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { WatchTokensService } from '@/watch/balance/watch-tokens.service'
import { Queue } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { QUEUES } from '@/common/redis/constants'
import { Solver } from '@/eco-configs/eco-config.types'
import { PublicClient, Hex, Log } from 'viem'
import { ERC20TransferLog } from '@/contracts'
import { Network } from '@/common/alchemy/network'
import { EcoAnalyticsService } from '@/analytics'

describe('WatchTokensService', () => {
  let service: WatchTokensService
  let mockQueue: DeepMocked<Queue>
  let mockPublicClientService: DeepMocked<MultichainPublicClientService>
  let mockEcoConfigService: DeepMocked<EcoConfigService>
  let mockKernelAccountClientService: DeepMocked<KernelAccountClientService>
  let mockPublicClient: DeepMocked<PublicClient>

  const mockLogLog = jest.fn()
  const mockLogWarn = jest.fn()
  const mockLogDebug = jest.fn()
  const mockLogError = jest.fn()

  const mockSolverAddress = '0x1234567890123456789012345678901234567890' as Hex
  const mockTokenAddress1 = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex // USDC
  const mockTokenAddress2 = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Hex // DAI

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
      [mockTokenAddress1]: {
        contractType: 'erc20',
        selectors: ['0x12345678'],
        minBalance: 1000000,
        targetBalance: 10000000,
        maxBalance: 100000000,
      },
      [mockTokenAddress2]: {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchTokensService,
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
        {
          provide: EcoAnalyticsService,
          useValue: createMock<EcoAnalyticsService>(),
        },
      ],
    }).compile()

    service = module.get<WatchTokensService>(WatchTokensService)
    mockQueue = module.get(getQueueToken(QUEUES.BALANCE_MONITOR.queue))
    mockPublicClientService = module.get(MultichainPublicClientService)
    mockEcoConfigService = module.get(EcoConfigService)
    mockKernelAccountClientService = module.get(KernelAccountClientService)

    // Create mock public client
    mockPublicClient = createMock<PublicClient>()
    mockPublicClient.watchContractEvent.mockReturnValue(jest.fn())

    // Setup default mocks
    mockPublicClientService.getClient.mockResolvedValue(mockPublicClient)
    mockEcoConfigService.getSolvers.mockReturnValue(mockSolvers)
    mockKernelAccountClientService.getClient.mockResolvedValue({
      kernelAccount: { address: mockSolverAddress },
    } as any)

    service['logger'].log = mockLogLog
    service['logger'].warn = mockLogWarn
    service['logger'].debug = mockLogDebug
    service['logger'].error = mockLogError

    jest.clearAllMocks()
  })

  afterEach(() => {
    mockLogLog.mockClear()
    mockLogWarn.mockClear()
    mockLogDebug.mockClear()
    mockLogError.mockClear()
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
    it('should subscribe to Transfer events for solver tokens', async () => {
      await service.subscribeTo(mockPublicClient, mockSolver)

      expect(mockKernelAccountClientService.getClient).toHaveBeenCalledWith(1)
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledTimes(2) // incoming and outgoing

      // Verify incoming transfers subscription
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: [mockTokenAddress1, mockTokenAddress2],
          eventName: 'Transfer',
          args: { to: [mockSolverAddress] },
        }),
      )

      // Verify outgoing transfers subscription
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: [mockTokenAddress1, mockTokenAddress2],
          eventName: 'Transfer',
          args: { from: [mockSolverAddress] },
        }),
      )
    })

    it('should skip subscription if no solver address found', async () => {
      mockKernelAccountClientService.getClient.mockResolvedValue({
        kernelAccount: null,
      } as any)

      await service.subscribeTo(mockPublicClient, mockSolver)

      expect(mockPublicClient.watchContractEvent).not.toHaveBeenCalled()
    })

    it('should skip subscription if no ERC20 targets found', async () => {
      const solverWithoutERC20 = {
        ...mockSolver,
        targets: {
          ['0x1230000000000000000000000000000000000000' as Hex]: {
            contractType: 'erc721' as const,
            selectors: ['0x12345678'],
            minBalance: 0,
            targetBalance: 0,
            maxBalance: 0,
          },
        },
      }

      await service.subscribeTo(mockPublicClient, solverWithoutERC20)

      expect(mockPublicClient.watchContractEvent).not.toHaveBeenCalled()
    })

    it('should handle kernel client errors gracefully', async () => {
      mockKernelAccountClientService.getClient.mockRejectedValue(new Error('Kernel client error'))

      await service.subscribeTo(mockPublicClient, mockSolver)

      expect(mockPublicClient.watchContractEvent).not.toHaveBeenCalled()
    })
  })

  describe('addJob (Transfer event processing)', () => {
    const mockTransferLog: ERC20TransferLog = {
      address: mockTokenAddress1,
      blockNumber: 18500000n,
      blockHash: '0xabcdef123456abcdef123456abcdef123456abcdef123456abcdef123456abcdef12' as Hex,
      transactionHash: '0x0987654321987654321987654321987654321987654321987654321987654321' as Hex,
      logIndex: 1,
      transactionIndex: 0,
      removed: false,
      data: '0x' as Hex,
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as Hex,
        '0x0000000000000000000000001111111111111111111111111111111111111111' as Hex,
        `0x000000000000000000000000${mockSolverAddress.slice(2)}` as Hex,
      ],
      args: {
        from: '0x1111111111111111111111111111111111111111' as Hex,
        to: mockSolverAddress,
        value: 1000000n, // 1 USDC (6 decimals)
      },
      eventName: 'Transfer',
      sourceChainID: BigInt(1),
      sourceNetwork: Network.ETH_MAINNET,
    } as ERC20TransferLog

    it('should process incoming transfer logs correctly', async () => {
      const addJobFunction = service.addJob(mockSolver)
      await addJobFunction([mockTransferLog])

      expect(mockQueue.add).toHaveBeenCalledWith(
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          chainId: '1',
          address: mockTokenAddress1,
          changeAmount: '1000000',
          direction: 'incoming',
          blockNumber: '18500000',
          blockHash: '0xabcdef123456abcdef123456abcdef123456abcdef123456abcdef123456abcdef12',
          transactionHash: '0x0987654321987654321987654321987654321987654321987654321987654321',
          from: '0x1111111111111111111111111111111111111111',
          to: mockSolverAddress,
        }),
        expect.objectContaining({
          jobId: expect.stringContaining('watch-token-balance-change'),
        }),
      )
    })

    it('should process outgoing transfer logs correctly', async () => {
      const outgoingTransferLog = {
        ...mockTransferLog,
        args: {
          ...mockTransferLog.args,
          from: mockSolverAddress,
          to: '0x1111111111111111111111111111111111111111' as Hex,
        },
      }

      const addJobFunction = service.addJob(mockSolver)
      await addJobFunction([outgoingTransferLog])

      expect(mockQueue.add).toHaveBeenCalledWith(
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          direction: 'outgoing',
          from: mockSolverAddress,
          to: '0x1111111111111111111111111111111111111111',
        }),
        expect.any(Object),
      )
    })

    it('should handle multiple transfer logs in a batch', async () => {
      const secondTransferLog = {
        ...mockTransferLog,
        address: mockTokenAddress2,
        transactionHash:
          '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        logIndex: 2,
        args: {
          ...mockTransferLog.args,
          value: 2000000n,
        },
      }

      const addJobFunction = service.addJob(mockSolver)
      await addJobFunction([mockTransferLog, secondTransferLog])

      expect(mockQueue.add).toHaveBeenCalledTimes(2)
      expect(mockQueue.add).toHaveBeenNthCalledWith(
        1,
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          address: mockTokenAddress1,
          changeAmount: '1000000',
        }),
        expect.any(Object),
      )
      expect(mockQueue.add).toHaveBeenNthCalledWith(
        2,
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          address: mockTokenAddress2,
          changeAmount: '2000000',
        }),
        expect.any(Object),
      )
    })

    it('should handle transfer logs when solver address cannot be determined', async () => {
      mockKernelAccountClientService.getClient.mockResolvedValue({
        kernelAccount: null,
      } as any)

      const addJobFunction = service.addJob(mockSolver)
      await addJobFunction([mockTransferLog])

      expect(mockQueue.add).not.toHaveBeenCalled()
    })

    it('should generate unique job IDs for different logs', async () => {
      const secondTransferLog = {
        ...mockTransferLog,
        transactionHash:
          '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        logIndex: 2,
      }

      const addJobFunction = service.addJob(mockSolver)
      await addJobFunction([mockTransferLog, secondTransferLog])

      expect(mockQueue.add).toHaveBeenCalledTimes(2)

      const firstCallJobId = (mockQueue.add as jest.Mock).mock.calls[0][2].jobId
      const secondCallJobId = (mockQueue.add as jest.Mock).mock.calls[1][2].jobId

      expect(firstCallJobId).not.toEqual(secondCallJobId)
      expect(firstCallJobId).toContain('watch-token-balance-change')
      expect(secondCallJobId).toContain('watch-token-balance-change')
    })

    it('should handle errors during job creation gracefully', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'))

      const addJobFunction = service.addJob(mockSolver)

      await expect(addJobFunction([mockTransferLog])).resolves.not.toThrow()
      expect(mockQueue.add).toHaveBeenCalled()
    })
  })

  describe('getSolverAddress', () => {
    it('should return kernel account address when available', async () => {
      const result = await (service as any).getSolverAddress(mockSolver)

      expect(result).toBe(mockSolverAddress)
      expect(mockKernelAccountClientService.getClient).toHaveBeenCalledWith(1)
    })

    it('should return null when kernel account is not available', async () => {
      mockKernelAccountClientService.getClient.mockResolvedValue({
        kernelAccount: null,
      } as any)

      const result = await (service as any).getSolverAddress(mockSolver)

      expect(result).toBeNull()
    })

    it('should return null when kernel account address is undefined', async () => {
      mockKernelAccountClientService.getClient.mockResolvedValue({
        kernelAccount: { address: undefined },
      } as any)

      const result = await (service as any).getSolverAddress(mockSolver)

      expect(result).toBeNull()
    })

    it('should handle kernel client service errors', async () => {
      mockKernelAccountClientService.getClient.mockRejectedValue(new Error('Kernel service error'))

      const result = await (service as any).getSolverAddress(mockSolver)

      expect(result).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should handle watch event errors via onError callback', async () => {
      let onErrorCallback: (error: Error) => Promise<void>

      mockPublicClient.watchContractEvent.mockImplementation((options: any) => {
        onErrorCallback = options.onError
        return jest.fn()
      })

      await service.subscribeTo(mockPublicClient, mockSolver)

      // Simulate an error
      const error = new Error('WebSocket connection lost')
      await expect(onErrorCallback!(error)).resolves.not.toThrow()
    })

    it('should handle large transfer amounts correctly', async () => {
      const largeTransferLog: ERC20TransferLog = {
        address: mockTokenAddress1,
        blockNumber: 18500000n,
        blockHash: '0xabcdef123456abcdef123456abcdef123456abcdef123456abcdef123456abcdef12' as Hex,
        transactionHash:
          '0x0987654321987654321987654321987654321987654321987654321987654321' as Hex,
        logIndex: 1,
        transactionIndex: 0,
        removed: false,
        data: '0x' as Hex,
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as Hex,
          '0x0000000000000000000000001111111111111111111111111111111111111111' as Hex,
          `0x000000000000000000000000${mockSolverAddress.slice(2)}` as Hex,
        ],
        args: {
          from: '0x1111111111111111111111111111111111111111' as Hex,
          to: mockSolverAddress,
          value: BigInt('999999999999999999999999'), // Very large amount
        },
        eventName: 'Transfer',
        sourceChainID: BigInt(1),
        sourceNetwork: Network.ETH_MAINNET,
      } as ERC20TransferLog

      const addJobFunction = service.addJob(mockSolver)
      await addJobFunction([largeTransferLog])

      expect(mockQueue.add).toHaveBeenCalledWith(
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          changeAmount: '999999999999999999999999',
        }),
        expect.any(Object),
      )
    })
  })

  describe('integration scenarios', () => {
    it('should handle a complete transfer monitoring workflow', async () => {
      // Subscribe to events
      await service.subscribe()

      // Verify subscription setup
      expect(mockPublicClient.watchContractEvent).toHaveBeenCalledTimes(2)

      // Get the onLogs callback
      const onLogsCallback = (mockPublicClient.watchContractEvent as jest.Mock).mock.calls[0][0]
        .onLogs

      // Simulate receiving transfer logs
      const testTransferLog: ERC20TransferLog = {
        address: mockTokenAddress1,
        blockNumber: 18500000n,
        blockHash: '0xabcdef123456abcdef123456abcdef123456abcdef123456abcdef123456abcdef12' as Hex,
        transactionHash:
          '0x0987654321987654321987654321987654321987654321987654321987654321' as Hex,
        logIndex: 1,
        transactionIndex: 0,
        removed: false,
        data: '0x' as Hex,
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as Hex,
          '0x0000000000000000000000001111111111111111111111111111111111111111' as Hex,
          `0x000000000000000000000000${mockSolverAddress.slice(2)}` as Hex,
        ],
        args: {
          from: '0x1111111111111111111111111111111111111111' as Hex,
          to: mockSolverAddress,
          value: 1000000n,
        },
        eventName: 'Transfer',
        sourceChainID: BigInt(1),
        sourceNetwork: Network.ETH_MAINNET,
      } as ERC20TransferLog
      const mockLogs = [testTransferLog]
      await onLogsCallback(mockLogs)

      // Verify job was created
      expect(mockQueue.add).toHaveBeenCalledWith(
        QUEUES.BALANCE_MONITOR.jobs.update_balance_change,
        expect.objectContaining({
          chainId: '1',
          address: mockTokenAddress1,
          direction: 'incoming',
        }),
        expect.any(Object),
      )
    })

    it('should handle subscription to chains with no ERC20 tokens', async () => {
      const solverWithoutTokens = {
        ...mockSolver,
        targets: {},
      }
      mockEcoConfigService.getSolvers.mockReturnValue({ 1: solverWithoutTokens })

      await service.subscribe()

      expect(mockPublicClient.watchContractEvent).not.toHaveBeenCalled()
    })
  })
})
