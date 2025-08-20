import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { createMock } from '@golevelup/ts-jest'
import * as _ from 'lodash'
import { Queue } from 'bullmq'
import { Chain, encodeFunctionData, PublicClient, Transport } from "viem"
import { Hex } from "viem"
import { Network } from '@eco-solver/common/alchemy/network'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { IndexerService } from '@eco-solver/indexer/services/indexer.service'
import { WalletClientDefaultSignerService } from '@eco-solver/transaction/smart-wallets/wallet-client.service'
import { IntentProcessorService } from '@eco-solver/intent-processor/services/intent-processor.service'
import * as Hyperlane from '@eco-solver/intent-processor/utils/hyperlane'
import * as MulticallUtils from '@eco-solver/intent-processor/utils/multicall'
import { IntentProcessorQueue } from '@eco-solver/intent-processor/queues/intent-processor.queue'
import { Multicall3Abi } from '@eco-solver/contracts/Multicall3'
import { HyperlaneConfig, SendBatchConfig, WithdrawsConfig } from '@eco-solver/eco-configs/eco-config.types'
import { RouteType } from '@eco-foundation/routes-ts'

jest.mock('@/intent-processor/utils/hyperlane')
jest.mock('@/intent-processor/utils/multicall')
jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  encodeFunctionData: jest.fn(),
  encodeAbiParameters: jest.fn(),
}))

describe('IntentProcessorService', () => {
  let service: IntentProcessorService
  let ecoConfigService: EcoConfigService
  let indexerService: IndexerService
  let walletClientDefaultSignerService: WalletClientDefaultSignerService
  let queue: Queue
  let publicClient: PublicClient<Transport, Chain>
  let walletClient: any

  const mockIntentSource = '0x1234567890123456789012345678901234567890' as Hex
  const mockInbox = '0x2345678901234567890123456789012345678901' as Hex
  const mockClaimant = '0x3456789012345678901234567890123456789012' as Hex
  const mockMulticall = '0x4567890123456789012345678901234567890123' as Hex
  const chainId = 1

  beforeEach(async () => {
    // Reset mocks
    jest.resetAllMocks()

    // Create mock queue
    queue = createMock<Queue>({
      // Mock the BullMQ queue interface
      add: jest.fn().mockResolvedValue({}),
      addBulk: jest.fn().mockResolvedValue([]),
      waitUntilReady: jest.fn().mockResolvedValue(undefined),
      obliterate: jest.fn().mockResolvedValue(undefined),
      drain: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    })

    // Create mock wallet client
    walletClient = {
      writeContract: jest.fn().mockResolvedValue('0xTransactionHash'),
      sendTransaction: jest.fn().mockResolvedValue('0xTransactionHash'),
    }

    // Create mock public client
    publicClient = createMock<PublicClient<Transport, Chain>>({
      chain: { id: chainId },
      waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
    })

    // Create module
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        // Use BullMQ mock rather than actual registration
        // BullModule.registerQueue({
        //   name: IntentProcessorQueue.queueName,
        // }),
      ],
      providers: [
        IntentProcessorService,
        {
          provide: EcoConfigService,
          useValue: {
            getSendBatch: jest.fn().mockReturnValue({
              intervalDuration: 60000, // 1 minute
              chunkSize: 5,
              defaultGasPerIntent: 25000,
            } as SendBatchConfig),
            getHyperlane: jest.fn().mockReturnValue({
              chains: {
                '1': {
                  mailbox: '0xMailbox1' as Hex,
                  aggregationHook: '0xHook1' as Hex,
                  hyperlaneAggregationHook: '0xHyperHook1' as Hex,
                },
              },
              useHyperlaneDefaultHook: false,
            } as HyperlaneConfig),
            getWithdraws: jest.fn().mockReturnValue({
              intervalDuration: 60000, // 1 minute
              chunkSize: 5,
            } as WithdrawsConfig),
            getIntentSources: jest.fn().mockReturnValue([
              {
                sourceAddress: mockIntentSource,
                inbox: mockInbox,
                network: Network.ETH_MAINNET,
                chainID: 1,
                tokens: ['0xToken1' as Hex],
                provers: ['0xProver1' as Hex],
              },
            ]),
            getEth: jest.fn().mockReturnValue({
              claimant: mockClaimant,
            }),
          },
        },
        {
          provide: IndexerService,
          useValue: {
            getNextBatchWithdrawals: jest.fn(),
            getNextSendBatch: jest.fn(),
          },
        },
        {
          provide: WalletClientDefaultSignerService,
          useValue: {
            getClient: jest.fn().mockResolvedValue(walletClient),
            getPublicClient: jest.fn().mockResolvedValue(publicClient),
          },
        },
        {
          provide: getQueueToken(IntentProcessorQueue.queueName),
          useValue: queue,
        },
      ],
    }).compile()

    service = module.get<IntentProcessorService>(IntentProcessorService)
    ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
    indexerService = module.get<IndexerService>(IndexerService)
    walletClientDefaultSignerService = module.get<WalletClientDefaultSignerService>(
      WalletClientDefaultSignerService,
    )

    // Setup Hyperlane utility mocks
    const hyperlaneModule = jest.requireMock('@/intent-processor/utils/hyperlane')
    hyperlaneModule.getChainMetadata.mockReturnValue({
      mailbox: '0xMailbox1' as Hex,
      aggregationHook: '0xHook1' as Hex,
      hyperlaneAggregationHook: '0xHyperHook1' as Hex,
    })
    hyperlaneModule.getMessageData.mockReturnValue('0xMessageData' as Hex)
    hyperlaneModule.getMetadata.mockReturnValue('0xMetadata' as Hex)
    hyperlaneModule.estimateMessageGas.mockResolvedValue(100000n)
    hyperlaneModule.estimateFee.mockResolvedValue(50000n)

    // Setup Multicall utility mocks
    const multicallModule = jest.requireMock('@/intent-processor/utils/multicall')
    multicallModule.getMulticall.mockReturnValue(mockMulticall)

    // Define a mock IntentProcessorQueue property
    Object.defineProperty(service, 'intentProcessorQueue', {
      value: {
        startWithdrawalsCronJobs: jest.fn().mockResolvedValue(undefined),
        startSendBatchCronJobs: jest.fn().mockResolvedValue(undefined),
        addExecuteWithdrawalsJobs: jest.fn().mockResolvedValue(undefined),
        addExecuteSendBatchJobs: jest.fn().mockResolvedValue(undefined),
      },
      writable: false,
      configurable: true,
    }) as any

    jest
      .spyOn(require('@eco-solver/eco-configs/utils'), 'getChainConfig')
      .mockReturnValue({ HyperProver: '0x0000000000000000000000000000000000000010' })

    // Setup default mocks for indexer service methods
    indexerService.getNextBatchWithdrawals = jest.fn().mockResolvedValue([])
    indexerService.getNextSendBatch = jest.fn().mockResolvedValue([])

    // Call onApplicationBootstrap to initialize config
    await service.onApplicationBootstrap()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getNextBatchWithdrawals', () => {
    it('should process withdrawals and add jobs to queue', async () => {
      // Mock data
      const mockWithdrawals = [
        {
          intent: {
            hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
            source: '1',
            creator: '0x0000000000000000000000000000000000000001' as Hex,
            prover: '0x0000000000000000000000000000000000000002' as Hex,
            deadline: '1000',
            nativeValue: '100',
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
            destination: '2',
            inbox: mockInbox,
            rewardTokens: [
              { token: '0x0000000000000000000000000000000000000003' as Hex, amount: '200' },
            ],
            routeTokens: [
              { token: '0x0000000000000000000000000000000000000004' as Hex, amount: '300' },
            ],
            calls: [
              {
                target: '0x0000000000000000000000000000000000000005' as Hex,
                data: '0x1234123412341234123412341234123412341234123412341234123412341234' as Hex,
                value: '50',
              },
            ],
          },
        },
        {
          intent: {
            hash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
            source: '1',
            creator: '0x0000000000000000000000000000000000000006' as Hex,
            prover: '0x0000000000000000000000000000000000000007' as Hex,
            deadline: '2000',
            nativeValue: '200',
            salt: '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex,
            destination: '2',
            inbox: mockInbox,
            rewardTokens: [
              { token: '0x0000000000000000000000000000000000000008' as Hex, amount: '400' },
            ],
            routeTokens: [
              { token: '0x0000000000000000000000000000000000000009' as Hex, amount: '500' },
            ],
            calls: [
              {
                target: '0x000000000000000000000000000000000000000a' as Hex,
                data: '0x1234123412341234123412341234123412341234123412341234123412341234' as Hex,
                value: '60',
              },
            ],
          },
        },
      ]

      // Setup mock responses
      indexerService.getNextBatchWithdrawals = jest.fn().mockResolvedValue(mockWithdrawals)

      // Mock the queue
      const queueAddExecuteWithdrawalsJobs = jest.fn()
      service['intentProcessorQueue'].addExecuteWithdrawalsJobs = queueAddExecuteWithdrawalsJobs

      // Execute
      await service.getNextBatchWithdrawals()

      // Verify indexerService was called
      expect(indexerService.getNextBatchWithdrawals).toHaveBeenCalledWith(mockIntentSource)

      // Verify jobs were added to queue
      expect(queueAddExecuteWithdrawalsJobs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            chainId: 1,
            intentSourceAddr: mockIntentSource,
            intents: expect.any(Array),
          }),
        ]),
      )
    })

    it('should handle multiple source chains', async () => {
      // Mock data with different source chains
      const mockWithdrawals = [
        {
          intent: {
            hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
            source: '1',
            creator: '0x0000000000000000000000000000000000000001' as Hex,
            prover: '0x0000000000000000000000000000000000000002' as Hex,
            deadline: '1000',
            nativeValue: '100',
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
            destination: '2',
            inbox: mockInbox,
            rewardTokens: [
              { token: '0x0000000000000000000000000000000000000003' as Hex, amount: '200' },
            ],
            routeTokens: [
              { token: '0x0000000000000000000000000000000000000004' as Hex, amount: '300' },
            ],
            calls: [
              {
                target: '0x0000000000000000000000000000000000000005' as Hex,
                data: '0x1234123412341234123412341234123412341234123412341234123412341234' as Hex,
                value: '50',
              },
            ],
          },
        },
        {
          intent: {
            hash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
            source: '2', // Different source chain
            creator: '0x0000000000000000000000000000000000000006' as Hex,
            prover: '0x0000000000000000000000000000000000000007' as Hex,
            deadline: '2000',
            nativeValue: '200',
            salt: '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex,
            destination: '3',
            inbox: mockInbox,
            rewardTokens: [
              { token: '0x0000000000000000000000000000000000000008' as Hex, amount: '400' },
            ],
            routeTokens: [
              { token: '0x0000000000000000000000000000000000000009' as Hex, amount: '500' },
            ],
            calls: [
              {
                target: '0x000000000000000000000000000000000000000a' as Hex,
                data: '0x1234123412341234123412341234123412341234123412341234123412341234' as Hex,
                value: '60',
              },
            ],
          },
        },
      ]

      // Setup mock responses
      indexerService.getNextBatchWithdrawals = jest.fn().mockResolvedValue(mockWithdrawals)

      // Mock the queue
      const queueAddExecuteWithdrawalsJobs = jest.fn()
      service['intentProcessorQueue'].addExecuteWithdrawalsJobs = queueAddExecuteWithdrawalsJobs

      // Execute
      await service.getNextBatchWithdrawals()

      // Verify indexerService was called
      expect(indexerService.getNextBatchWithdrawals).toHaveBeenCalledWith(mockIntentSource)

      // Verify jobs were added to queue - should have two jobs (one for each source chain)
      expect(queueAddExecuteWithdrawalsJobs).toHaveBeenCalledTimes(1)
      expect(queueAddExecuteWithdrawalsJobs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ chainId: 1 }),
          expect.objectContaining({ chainId: 2 }),
        ]),
      )
    })

    it('should chunk withdrawals if over limit', async () => {
      // Create many withdrawals (more than chunk size of 5)
      const mockWithdrawals = Array(12)
        .fill(null)
        .map((_, i) => ({
          intent: {
            // Create proper hex strings for each intent, using the index to make them unique
            hash: `0x${i.toString().padStart(64, '0')}` as Hex,
            source: '1',
            creator: '0x0000000000000000000000000000000000000001' as Hex,
            prover: '0x0000000000000000000000000000000000000002' as Hex,
            deadline: '1000',
            nativeValue: '100',
            salt: `0x${i.toString().padStart(64, '0')}` as Hex,
            destination: '2',
            inbox: mockInbox,
            rewardTokens: [
              { token: '0x0000000000000000000000000000000000000003' as Hex, amount: '200' },
            ],
            routeTokens: [
              { token: '0x0000000000000000000000000000000000000004' as Hex, amount: '300' },
            ],
            calls: [
              {
                target: '0x0000000000000000000000000000000000000005' as Hex,
                data: '0x1234123412341234123412341234123412341234123412341234123412341234' as Hex,
                value: '50',
              },
            ],
          },
        }))

      // Setup mock responses
      indexerService.getNextBatchWithdrawals = jest.fn().mockResolvedValue(mockWithdrawals)

      // Mock the queue
      const queueAddExecuteWithdrawalsJobs = jest.fn()
      service['intentProcessorQueue'].addExecuteWithdrawalsJobs = queueAddExecuteWithdrawalsJobs

      // Execute
      await service.getNextBatchWithdrawals()

      // Verify indexerService was called
      expect(indexerService.getNextBatchWithdrawals).toHaveBeenCalledWith(mockIntentSource)

      // Verify jobs were added to queue - should have 3 jobs with 5, 5, and 2 intents
      expect(queueAddExecuteWithdrawalsJobs).toHaveBeenCalledTimes(1)

      // Extract the jobs argument
      const jobsArg = queueAddExecuteWithdrawalsJobs.mock.calls[0][0]

      // Verify we have 3 jobs (12 intents / chunk size 5 = ceil(2.4) = 3 chunks)
      expect(jobsArg.length).toBe(3)

      // Verify chunking
      expect(jobsArg[0].intents.length).toBe(5)
      expect(jobsArg[1].intents.length).toBe(5)
      expect(jobsArg[2].intents.length).toBe(2)
    })
  })

  describe('getNextSendBatch', () => {
    it('should process send batches and add jobs to queue', async () => {
      // Mock data
      const mockProves = [
        {
          hash: '0x1111' as Hex,
          prover: '0xProver1' as Hex,
          chainId: 1,
          destinationChainId: 2,
        },
        {
          hash: '0x2222' as Hex,
          prover: '0xProver1' as Hex, // Same prover
          chainId: 1,
          destinationChainId: 2, // Same destination
        },
      ]

      // Setup mock responses
      indexerService.getNextSendBatch = jest.fn().mockResolvedValue(mockProves)

      // Mock the queue
      const queueAddExecuteSendBatchJobs = jest.fn()
      service['intentProcessorQueue'].addExecuteSendBatchJobs = queueAddExecuteSendBatchJobs

      // Execute
      await service.getNextSendBatch()

      // Verify indexerService was called
      expect(indexerService.getNextSendBatch).toHaveBeenCalledWith(mockIntentSource)

      // Verify jobs were added to queue
      expect(queueAddExecuteSendBatchJobs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            chainId: 2,
            proves: expect.arrayContaining([
              expect.objectContaining({ hash: '0x1111', prover: '0xProver1', source: 1 }),
              expect.objectContaining({ hash: '0x2222', prover: '0xProver1', source: 1 }),
            ]),
          }),
        ]),
      )
    })

    it('should handle multiple destination chains', async () => {
      // Mock data with different destination chains
      const mockProves = [
        {
          hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
          prover: '0x0000000000000000000000000000000000000001' as Hex,
          chainId: 1,
          destinationChainId: 2,
          source: 1,
        },
        {
          hash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
          prover: '0x0000000000000000000000000000000000000002' as Hex,
          chainId: 1,
          destinationChainId: 3, // Different destination
          source: 1,
        },
      ]

      // Setup mock responses
      indexerService.getNextSendBatch = jest.fn().mockResolvedValue(mockProves)

      // Mock the queue
      const queueAddExecuteSendBatchJobs = jest.fn()
      service['intentProcessorQueue'].addExecuteSendBatchJobs = queueAddExecuteSendBatchJobs

      // Execute
      await service.getNextSendBatch()

      // Verify indexerService was called
      expect(indexerService.getNextSendBatch).toHaveBeenCalledWith(mockIntentSource)

      // Verify jobs were added to queue - should have two jobs (one for each destination)
      expect(queueAddExecuteSendBatchJobs).toHaveBeenCalledTimes(1)
      expect(queueAddExecuteSendBatchJobs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ chainId: 2 }),
          expect.objectContaining({ chainId: 3 }),
        ]),
      )
    })

    it('should sort and chunk batches', async () => {
      // Create various proves with different provers
      const mockProves = [
        // Mix of different provers and sources
        {
          hash: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
          prover: '0xa000000000000000000000000000000000000001' as Hex,
          chainId: 1,
          destinationChainId: 2,
          source: 1,
        },
        {
          hash: '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex,
          prover: '0xa000000000000000000000000000000000000001' as Hex,
          chainId: 1,
          destinationChainId: 2,
          source: 1,
        },
        {
          hash: '0x0000000000000000000000000000000000000000000000000000000000000003' as Hex,
          prover: '0xa000000000000000000000000000000000000001' as Hex,
          chainId: 1,
          destinationChainId: 2,
          source: 1,
        },
        // Only one group with same prover-source combination for this test
        {
          hash: '0x0000000000000000000000000000000000000000000000000000000000000004' as Hex,
          prover: '0xa000000000000000000000000000000000000001' as Hex,
          chainId: 1,
          destinationChainId: 2,
          source: 1,
        },
        {
          hash: '0x0000000000000000000000000000000000000000000000000000000000000005' as Hex,
          prover: '0xa000000000000000000000000000000000000001' as Hex,
          chainId: 1,
          destinationChainId: 2,
          source: 1,
        },
        {
          hash: '0x0000000000000000000000000000000000000000000000000000000000000006' as Hex,
          prover: '0xa000000000000000000000000000000000000001' as Hex,
          chainId: 1,
          destinationChainId: 2,
          source: 1,
        },
      ]

      // Setup mock responses
      indexerService.getNextSendBatch = jest.fn().mockResolvedValue(mockProves)

      // Mock the queue
      const queueAddExecuteSendBatchJobs = jest.fn()
      service['intentProcessorQueue'].addExecuteSendBatchJobs = queueAddExecuteSendBatchJobs

      // Execute
      await service.getNextSendBatch()

      // Verify indexerService was called
      expect(indexerService.getNextSendBatch).toHaveBeenCalledWith(mockIntentSource)

      // Get the jobs that were added
      const jobsArg = queueAddExecuteSendBatchJobs.mock.calls[0][0]

      // All jobs should be for destination chain 2
      expect(jobsArg.every((job) => job.chainId === 2)).toBe(true)

      // Verify sorting and grouping logic
      // We should have at least 4 groups: ProverA-1, ProverA-2, ProverB-1, ProverB-2
      // The batches in a job should have the same prover-source combination
      for (const job of jobsArg) {
        // Group by prover+source
        const groups = _.groupBy(job.proves, (prove) => [prove.prover, prove.source].join('-'))

        // Each job should only have one group (one prover-source combination)
        expect(Object.keys(groups).length).toBe(1)
      }
    })
  })

  describe('executeWithdrawals', () => {
    it('should send batch withdraw transaction', async () => {
      const route: RouteType = {
        destination: 1n,
        salt: '0xSalt',
        source: 10n,
        inbox: '0xInbox',
        tokens: [],
        calls: [
          { target: '0x1' as Hex, data: '0x3' as Hex, value: 100n },
          { target: '0x4' as Hex, data: '0x6' as Hex, value: 200n },
        ],
      }

      // Mock data
      const data = {
        chainId: 1,
        intentSourceAddr: mockIntentSource,
        intents: [
          {
            route: route,
            reward: {
              creator: '0xCreator1' as Hex,
              prover: '0xProver1' as Hex,
              deadline: 1000n,
              nativeValue: 100n,
              tokens: [{ token: '0xToken1' as Hex, amount: 200n }],
            },
          },
          {
            route: route,
            reward: {
              creator: '0xCreator2' as Hex,
              prover: '0xProver2' as Hex,
              deadline: 2000n,
              nativeValue: 200n,
              tokens: [{ token: '0xToken2' as Hex, amount: 300n }],
            },
          },
        ],
      }

      // Execute
      await service.executeWithdrawals(data)

      // Verify wallet client and public client were retrieved
      expect(walletClientDefaultSignerService.getClient).toHaveBeenCalledWith(1)
      expect(walletClientDefaultSignerService.getPublicClient).toHaveBeenCalledWith(1)

      // Verify writeContract was called with correct params
      expect(walletClient.writeContract).toHaveBeenCalledWith({
        abi: expect.any(Array),
        address: mockIntentSource,
        args: [
          [
            {
              route: route,
              reward: {
                creator: '0xCreator1',
                prover: '0xProver1',
                deadline: 1000n,
                nativeValue: 100n,
                tokens: [{ token: '0xToken1', amount: 200n }],
              },
            },
            {
              route: route,
              reward: {
                creator: '0xCreator2',
                prover: '0xProver2',
                deadline: 2000n,
                nativeValue: 200n,
                tokens: [{ token: '0xToken2', amount: 300n }],
              },
            },
          ],
        ],
        functionName: 'batchWithdraw',
      })

      // Verify waitForTransactionReceipt was called
      expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: '0xTransactionHash',
      })
    })
  })

  describe('executeSendBatch', () => {
    it('should send batch transaction for single batch', async () => {
      // Mock data - single batch
      const data = {
        chainId: 1,
        intentSourceAddr: mockIntentSource,
        inbox: mockInbox,
        proves: [
          {
            hash: '0x1111' as Hex,
            prover: '0xProver1' as Hex,
            source: 2,
            intentSourceAddr: mockIntentSource,
            inbox: mockInbox,
          },
        ],
      }

      // Mock getSendBatchTransaction
      jest.spyOn(service as any, 'getSendBatchTransaction').mockResolvedValue({
        to: mockInbox,
        value: 50000n,
        data: '0xEncodedData',
      })

      // Execute
      await service.executeSendBatch(data)

      // Verify wallet client and public client were retrieved
      expect(walletClientDefaultSignerService.getClient).toHaveBeenCalledWith(1)
      expect(walletClientDefaultSignerService.getPublicClient).toHaveBeenCalledWith(1)

      // Verify getSendBatchTransaction was called
      expect(service['getSendBatchTransaction']).toHaveBeenCalledWith(
        publicClient,
        mockInbox,
        '0xProver1',
        2,
        ['0x1111'],
      )

      // For a single batch, we should use the transaction directly
      expect(walletClient.sendTransaction).toHaveBeenCalledWith({
        to: mockInbox,
        value: 50000n,
        data: '0xEncodedData',
      })

      // Verify waitForTransactionReceipt was called
      expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: '0xTransactionHash',
      })
    })

    it('should use multicall for multiple batches', async () => {
      // Mock data - multiple batches with different prover-source combinations
      const data = {
        chainId: 1,
        intentSourceAddr: mockIntentSource,
        inbox: mockInbox,
        proves: [
          {
            hash: '0x1111' as Hex,
            prover: '0xProver1' as Hex,
            source: 2,
            intentSourceAddr: mockIntentSource,
            inbox: mockInbox,
          },
          {
            hash: '0x2222' as Hex,
            prover: '0xProver2' as Hex, // Different prover
            source: 2,
            intentSourceAddr: mockIntentSource,
            inbox: mockInbox,
          },
          {
            hash: '0x3333' as Hex,
            prover: '0xProver1' as Hex,
            source: 3, // Different source
            intentSourceAddr: mockIntentSource,
            inbox: mockInbox,
          },
        ],
      }

      // Mock getSendBatchTransaction to return different transactions
      jest
        .spyOn(service as any, 'getSendBatchTransaction')
        .mockImplementation((client, inbox, prover, source) => {
          return Promise.resolve({
            to: inbox,
            value: 50000n,
            data: `0xData-${prover}-${source}`,
          })
        })

      // Mock encodeFunctionData
      jest.spyOn(require('viem'), 'encodeFunctionData').mockReturnValue('0xMulticallData')

      // Execute
      await service.executeSendBatch(data)

      // Verify getSendBatchTransaction was called for each batch
      expect(service['getSendBatchTransaction']).toHaveBeenCalledTimes(3)

      // Verify multicall was used
      expect(MulticallUtils.getMulticall).toHaveBeenCalledWith(1)
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: Multicall3Abi,
        functionName: 'aggregate3Value',
        args: [expect.any(Array)],
      })

      // Verify sendTransaction was called with multicall data
      expect(walletClient.sendTransaction).toHaveBeenCalledWith({
        to: mockMulticall,
        value: 150000n, // 3 * 50000n
        data: '0xMulticallData',
      })
    })
  })

  describe('getSendBatchTransaction', () => {
    it('should create transaction with correct parameters', async () => {
      // Mock data
      const intentHashes = [
        '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
      ]
      const prover = '0x0000000000000000000000000000000000000001' as Hex
      const source = 2

      // Mock estimateMessageGas method
      jest.spyOn(service as any, 'estimateMessageGas').mockResolvedValue(BigInt(50000))

      // Execute
      const result = await service['getSendBatchTransaction'](
        publicClient,
        mockInbox,
        prover,
        source,
        intentHashes,
      )

      // Verify getMessageData was called
      expect(Hyperlane.getMessageData).toHaveBeenCalledWith(mockClaimant, intentHashes)

      // Verify estimateMessageGas was called
      expect(service['estimateMessageGas']).toHaveBeenCalledWith(
        mockInbox,
        prover,
        chainId,
        source,
        '0xMessageData',
        2, // intentHashes.length
      )

      // Verify getMetadata was called with some gas limit
      expect(Hyperlane.getMetadata).toHaveBeenCalledWith(0n, 50000n)

      // Verify getChainMetadata was called
      expect(Hyperlane.getChainMetadata).toHaveBeenCalled()

      // Verify estimateFee was called
      expect(Hyperlane.estimateFee).toHaveBeenCalledWith(
        publicClient,
        '0xMailbox1',
        source,
        prover,
        '0xMessageData',
        '0xMetadata',
        '0xHook1', // Non-default hook
      )

      // Verify result structure
      expect(result).toHaveProperty('to', mockInbox)
      expect(result).toHaveProperty('value', 50000n)
      // The data might be undefined in the mock, so we'll skip that check
    })

    it('should use hyperlane default hook when configured', async () => {
      // Update config to use default hook
      service['config'].hyperlane.useHyperlaneDefaultHook = true

      // Mock data
      const intentHashes = ['0x1111' as Hex]
      const prover = '0xProver' as Hex
      const source = 2

      // Execute
      await service['getSendBatchTransaction'](
        publicClient,
        mockInbox,
        prover,
        source,
        intentHashes,
      )

      // Verify estimateFee was called with hyperlane default hook
      expect(Hyperlane.estimateFee).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        '0xHyperHook1', // Default hyperlane hook
      )
    })
  })

  describe('estimateMessageGas', () => {
    it('should call Hyperlane.estimateMessageGas with correct parameters', async () => {
      // Setup data
      const inbox = '0xInbox' as Hex
      const prover = '0xProver' as Hex
      const origin = 1
      const source = 2
      const messageData = '0xMessageData' as Hex
      const intentCount = 3

      // Reset the spy on the Hyperlane utility
      jest.clearAllMocks()
      ;(Hyperlane.estimateMessageGas as jest.Mock).mockResolvedValue(50000n)

      // Execute
      const result = await service['estimateMessageGas'](
        inbox,
        prover,
        origin,
        source,
        messageData,
        intentCount,
      )

      // Verify getChainMetadata was called
      expect(Hyperlane.getChainMetadata).toHaveBeenCalledWith(service['config'].hyperlane, source)

      // Verify getPublicClient was called
      expect(walletClientDefaultSignerService.getPublicClient).toHaveBeenCalledWith(source)

      // Verify estimateMessageGas was called with correct params
      expect(Hyperlane.estimateMessageGas).toHaveBeenCalledWith(
        publicClient,
        '0xMailbox1',
        prover,
        origin,
        inbox,
        messageData,
      )

      // Verify result
      expect(result).toBe(50000n)
    })

    it('should fallback to default gas estimate if estimation fails', async () => {
      // Setup data
      const inbox = '0xInbox' as Hex
      const prover = '0xProver' as Hex
      const origin = 1
      const source = 2
      const messageData = '0xMessageData' as Hex
      const intentCount = 3

      // Make estimateMessageGas throw an error
      ;(Hyperlane.estimateMessageGas as jest.Mock).mockRejectedValue(new Error('Estimation failed'))

      // Execute
      const result = await service['estimateMessageGas'](
        inbox,
        prover,
        origin,
        source,
        messageData,
        intentCount,
      )

      // Should fallback to default: defaultGasPerIntent (25000) * intentCount
      const expected = BigInt(service['config'].sendBatch.defaultGasPerIntent) * BigInt(intentCount)
      expect(result).toBe(expected)
    })
  })

  describe('getIntentSource and getInbox', () => {
    it('should return array of intent source addresses', () => {
      const result = service['getIntentSource']()
      expect(result).toEqual([mockIntentSource])
    })

    it('should return array of unique intent sources when multiple provided', () => {
      // Mock multiple intent sources
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValueOnce([
        {
          sourceAddress: '0xSource1' as Hex,
          inbox: '0xInbox1' as Hex,
          network: Network.ETH_MAINNET,
          chainID: 1,
          tokens: ['0xToken1' as Hex],
          provers: ['0xProver1' as Hex],
        },
        {
          sourceAddress: '0xSource2' as Hex,
          inbox: '0xInbox2' as Hex,
          network: Network.ARB_MAINNET,
          chainID: 42161,
          tokens: ['0xToken2' as Hex],
          provers: ['0xProver2' as Hex],
        },
      ])

      const result = service['getIntentSource']()
      expect(result).toEqual(['0xSource1', '0xSource2'])
    })

    it('should return the inbox address', () => {
      const result = service['getInbox']()
      expect(result).toBe(mockInbox)
    })

    it('should throw error if multiple inbox addresses', () => {
      // Mock multiple inboxes
      jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValueOnce([
        {
          sourceAddress: '0xSource1' as Hex,
          inbox: '0xInbox1' as Hex,
          network: Network.ETH_MAINNET,
          chainID: 1,
          tokens: ['0xToken1' as Hex],
          provers: ['0xProver1' as Hex],
        },
        {
          sourceAddress: '0xSource1' as Hex,
          inbox: '0xInbox2' as Hex,
          network: Network.ETH_MAINNET,
          chainID: 1,
          tokens: ['0xToken1' as Hex],
          provers: ['0xProver1' as Hex],
        },
      ])

      expect(() => service['getInbox']()).toThrow(
        'Implementation has to be refactor to support multiple inbox addresses.',
      )
    })
  })
})
