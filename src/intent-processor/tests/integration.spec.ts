import { Test, TestingModule } from '@nestjs/testing'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { IndexerService } from '@/indexer/services/indexer.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { createMock } from '@golevelup/ts-jest'
import { Hex } from 'viem'
import { IntentProcessorQueue } from '@/intent-processor/queues/intent-processor.queue'
import { ExecuteWithdrawsJobManager } from '@/intent-processor/jobs/execute-withdraws.job'
import { ExecuteSendBatchJobManager } from '@/intent-processor/jobs/execute-send-batch.job'
import { Logger } from '@nestjs/common'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'
import * as Hyperlane from '@/intent-processor/utils/hyperlane'

// Mock the intent util module BEFORE tests run
jest.mock('@/intent-processor/utils/intent', () => ({
  getWithdrawData: jest.fn().mockImplementation(() => ({
    routeHash: '0x1234123412341234123412341234123412341234123412341234123412341234' as Hex,
    reward: { 
      creator: '0x0000000000000000000000000000000000000001' as Hex,
      prover: '0x0000000000000000000000000000000000000002' as Hex,
      deadline: BigInt(1234),
      nativeValue: BigInt(5678),
      tokens: [] 
    },
  })),
}))

/**
 * Integration tests for the intent processor workflow
 */
describe('Intent Processor - Integration Tests', () => {
  let service: IntentProcessorService
  let ecoConfigService: EcoConfigService
  let indexerService: IndexerService
  let walletClientService: WalletClientDefaultSignerService
  let mockQueue: any
  let mockIntentProcessorQueue: Partial<IntentProcessorQueue>

  beforeEach(async () => {
    // Setup mocks
    ecoConfigService = createMock<EcoConfigService>({
      getSendBatch: jest.fn().mockReturnValue({ 
        intervalDuration: 300000, 
        chunkSize: 2, // Small size for testing
        defaultGasPerIntent: 25000 
      }),
      getWithdraws: jest.fn().mockReturnValue({ 
        intervalDuration: 300000, 
        chunkSize: 2 // Small size for testing
      }),
      getHyperlane: jest.fn().mockReturnValue({ 
        useHyperlaneDefaultHook: true,
        chains: {},
        mappings: {
          '1': {
            mailbox: '0x1111111111111111111111111111111111111111' as Hex,
            aggregationHook: '0x2222222222222222222222222222222222222222' as Hex,
            hyperlaneAggregationHook: '0x3333333333333333333333333333333333333333' as Hex,
          },
          '10': {
            mailbox: '0x1111111111111111111111111111111111111111' as Hex,
            aggregationHook: '0x2222222222222222222222222222222222222222' as Hex,
            hyperlaneAggregationHook: '0x3333333333333333333333333333333333333333' as Hex,
          },
        }
      }),
      getIntentSources: jest.fn().mockReturnValue([
        { 
          sourceAddress: '0x1111111111111111111111111111111111111111' as Hex, 
          inbox: '0x2222222222222222222222222222222222222222' as Hex,
          network: 'ethereum',
          chainID: 1,
          tokens: [],
          provers: [],
        },
      ]),
      getEth: jest.fn().mockReturnValue({ claimant: '0x3333333333333333333333333333333333333333' as Hex }),
    })

    // Mock clients
    const mockWalletClient = {
      writeContract: jest.fn().mockResolvedValue('0x1111111111111111111111111111111111111111111111111111111111111111' as Hex),
      sendTransaction: jest.fn().mockResolvedValue('0x2222222222222222222222222222222222222222222222222222222222222222' as Hex),
    }

    const mockPublicClient = {
      waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
      chain: { id: 1 },
      readContract: jest.fn().mockResolvedValue(BigInt(1000)),
    }

    walletClientService = createMock<WalletClientDefaultSignerService>({
      getClient: jest.fn().mockResolvedValue(mockWalletClient),
      getPublicClient: jest.fn().mockResolvedValue(mockPublicClient),
    })

    // Mock indexer service with valid Hex addresses
    const mockWithdrawals = [
      {
        intent: {
          hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
          creator: '0x0000000000000000000000000000000000000001' as Hex,
          prover: '0x0000000000000000000000000000000000000002' as Hex,
          deadline: '123456',
          nativeValue: '1000000000000000000',
          source: '1',
          destination: '10',
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
          inbox: '0x2222222222222222222222222222222222222222' as Hex,
          rewardTokens: [{ token: '0x3333333333333333333333333333333333333333' as Hex, amount: '1000' }],
          routeTokens: [{ token: '0x4444444444444444444444444444444444444444' as Hex, amount: '2000' }],
          calls: [{ target: '0x5555555555555555555555555555555555555555' as Hex, data: '0xabcdef' as Hex, value: '500' }],
        },
      },
      {
        intent: {
          hash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
          creator: '0x0000000000000000000000000000000000000003' as Hex,
          prover: '0x0000000000000000000000000000000000000004' as Hex,
          deadline: '123456',
          nativeValue: '2000000000000000000',
          source: '1',
          destination: '10',
          salt: '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex,
          inbox: '0x2222222222222222222222222222222222222222' as Hex,
          rewardTokens: [{ token: '0x3333333333333333333333333333333333333333' as Hex, amount: '3000' }],
          routeTokens: [{ token: '0x4444444444444444444444444444444444444444' as Hex, amount: '4000' }],
          calls: [{ target: '0x5555555555555555555555555555555555555555' as Hex, data: '0xabcdef' as Hex, value: '600' }],
        },
      },
      {
        intent: {
          hash: '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex,
          creator: '0x0000000000000000000000000000000000000005' as Hex,
          prover: '0x0000000000000000000000000000000000000006' as Hex,
          deadline: '123456',
          nativeValue: '3000000000000000000',
          source: '10', // Different source chain
          destination: '1',
          salt: '0x0000000000000000000000000000000000000000000000000000000000000003' as Hex,
          inbox: '0x2222222222222222222222222222222222222222' as Hex,
          rewardTokens: [{ token: '0x3333333333333333333333333333333333333333' as Hex, amount: '5000' }],
          routeTokens: [{ token: '0x4444444444444444444444444444444444444444' as Hex, amount: '6000' }],
          calls: [{ target: '0x5555555555555555555555555555555555555555' as Hex, data: '0xabcdef' as Hex, value: '700' }],
        },
      },
    ]

    const mockSendBatches = [
      {
        hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        prover: '0x0000000000000000000000000000000000000001' as Hex,
        chainId: 1,
        destinationChainId: 10,
      },
      {
        hash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
        prover: '0x0000000000000000000000000000000000000001' as Hex,
        chainId: 1,
        destinationChainId: 10,
      },
      {
        hash: '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex,
        prover: '0x0000000000000000000000000000000000000002' as Hex, // Different prover
        chainId: 1,
        destinationChainId: 10,
      },
    ]

    indexerService = createMock<IndexerService>({
      getNextBatchWithdrawals: jest.fn().mockResolvedValue(mockWithdrawals),
      getNextSendBatch: jest.fn().mockResolvedValue(mockSendBatches),
    })

    // Mock queue for adding jobs
    mockQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    }

    // Create service instance directly to avoid NestJS DI issues
    service = new IntentProcessorService(
      mockQueue as any,
      ecoConfigService,
      indexerService,
      walletClientService,
    )
    
    // Initialize config directly since onApplicationBootstrap won't be called
    service['config'] = {
      sendBatch: {
        intervalDuration: 300000,
        chunkSize: 2, // Small size for testing
        defaultGasPerIntent: 25000
      },
      hyperlane: {
        useHyperlaneDefaultHook: true,
        chains: {
          '1': {
            mailbox: '0x1111111111111111111111111111111111111111' as Hex,
            aggregationHook: '0x2222222222222222222222222222222222222222' as Hex,
            hyperlaneAggregationHook: '0x3333333333333333333333333333333333333333' as Hex
          },
          '10': {
            mailbox: '0x1111111111111111111111111111111111111111' as Hex,
            aggregationHook: '0x2222222222222222222222222222222222222222' as Hex,
            hyperlaneAggregationHook: '0x3333333333333333333333333333333333333333' as Hex
          }
        }
      },
      withdrawals: {
        intervalDuration: 300000,
        chunkSize: 2 // Small size for testing
      }
    }

    // Create queue functions that simulate the real behavior
    mockIntentProcessorQueue = {
      startWithdrawalsCronJobs: jest.fn().mockResolvedValue(undefined),
      startSendBatchCronJobs: jest.fn().mockResolvedValue(undefined),
      
      // These methods will actually process the jobs immediately
      addExecuteWithdrawalsJobs: jest.fn().mockImplementation(async (jobsData) => {
        for (const jobData of jobsData) {
          // Directly call the service method instead of using the job manager
          await service.executeWithdrawals(jobData);
        }
      }),
      
      addExecuteSendBatchJobs: jest.fn().mockImplementation(async (jobsData) => {
        for (const jobData of jobsData) {
          // Directly call the service method instead of using the job manager
          await service.executeSendBatch(jobData);
        }
      }),
    }
    
    // Replace the queue with our mock
    Object.defineProperty(service, 'intentProcessorQueue', {
      value: mockIntentProcessorQueue,
      writable: false,
    });
    
    // Mock console to reduce output noise
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Withdrawal Workflow', () => {
    it('should process batch withdrawals by calling service methods in sequence', async () => {
      // Create withdrawal data with proper Hex addresses
      const withdrawalData = [
        {
          intent: {
            hash: '0xab12f87c2e187b4d2b45f482a01c165c22d01b7e6ccdbb16a8c10e1bf6d31865' as Hex,
            creator: '0x0000000000000000000000000000000000000001' as Hex,
            prover: '0x0000000000000000000000000000000000000002' as Hex,
            deadline: '1234567890',
            nativeValue: '1000000000000000000', // 1 ETH
            source: '1',
            destination: '10',
            salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
            inbox: '0x0000000000000000000000000000000000000003' as Hex,
            rewardTokens: [],
            routeTokens: [],
            calls: [],
          },
        }
      ]
      
      // Setup mocks
      indexerService.getNextBatchWithdrawals = jest.fn().mockResolvedValue(withdrawalData)
      
      // 1. Verify getNextBatchWithdrawals calls the indexer
      await service.getNextBatchWithdrawals()
      expect(indexerService.getNextBatchWithdrawals).toHaveBeenCalledWith('0x1111111111111111111111111111111111111111')
      
      // 2. Verify jobs are created
      expect(mockIntentProcessorQueue.addExecuteWithdrawalsJobs).toHaveBeenCalled()
      
      // 3. Verify job was called with the right shape
      expect(mockIntentProcessorQueue.addExecuteWithdrawalsJobs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            chainId: 1,
            intentSourceAddr: '0x1111111111111111111111111111111111111111',
            intents: expect.any(Array)
          })
        ])
      )
    })
    
    it('should handle empty withdrawal batches gracefully', async () => {
      // Mock empty batch response
      indexerService.getNextBatchWithdrawals = jest.fn().mockResolvedValue([])
      
      // Should complete without error
      await service.getNextBatchWithdrawals()
      
      // Verify indexer was still called
      expect(indexerService.getNextBatchWithdrawals).toHaveBeenCalledWith('0x1111111111111111111111111111111111111111')
      
      // No jobs should be created
      expect(mockIntentProcessorQueue.addExecuteWithdrawalsJobs).toHaveBeenCalledWith([])
      
      // Wallet client should not have been called
      expect(walletClientService.getClient).not.toHaveBeenCalled()
    })
    
    it('should handle indexer errors during withdrawal processing', async () => {
      // Mock indexer error
      indexerService.getNextBatchWithdrawals = jest.fn().mockRejectedValue(new Error('Indexer failure'))
      
      // Should propagate the error
      await expect(service.getNextBatchWithdrawals()).rejects.toThrow('Indexer failure')
      
      // No jobs should be created
      expect(mockIntentProcessorQueue.addExecuteWithdrawalsJobs).not.toHaveBeenCalled()
    })
    
    it('should handle transaction errors during execution', async () => {
      // Test executeWithdrawals directly with error handling
      
      // Setup mock clients
      const mockWalletClient = {
        writeContract: jest.fn().mockRejectedValue(new Error('Transaction reverted')),
      }
      
      const mockPublicClient = {
        waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
        chain: { id: 1 },
      }
      
      walletClientService.getClient = jest.fn().mockResolvedValue(mockWalletClient)
      walletClientService.getPublicClient = jest.fn().mockResolvedValue(mockPublicClient)
      
      // Create a job data object directly with proper Hex addresses
      const jobData = {
        chainId: 1,
        intentSourceAddr: '0x1111111111111111111111111111111111111111' as Hex,
        intents: [
          {
            routeHash: '0x1234123412341234123412341234123412341234123412341234123412341234' as Hex,
            reward: {
              creator: '0x0000000000000000000000000000000000000001' as Hex,
              prover: '0x0000000000000000000000000000000000000002' as Hex,
              deadline: BigInt(1234567890),
              nativeValue: BigInt(1000000000000000000), // 1 ETH
              tokens: [],
            },
          },
        ],
      }
      
      // Execute with error handling
      try {
        await service.executeWithdrawals(jobData)
        fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).toBe('Transaction reverted')
      }
      
      // Verify client was obtained but no successful transaction
      expect(walletClientService.getClient).toHaveBeenCalledWith(1)
      expect(mockWalletClient.writeContract).toHaveBeenCalled()
      expect(mockPublicClient.waitForTransactionReceipt).not.toHaveBeenCalled()
    })
  })

  describe('Send Batch Workflow', () => {
    it('should process send batches end-to-end', async () => {
      // Create real-world send batch data with properly formatted addresses
      const realSendBatchData = [
        {
          hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
          prover: '0x0000000000000000000000000000000000000001' as Hex,
          chainId: 1, // Ethereum
          destinationChainId: 10, // Optimism
        },
        {
          hash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
          prover: '0x0000000000000000000000000000000000000001' as Hex, // Same prover
          chainId: 1, // Ethereum
          destinationChainId: 10, // Optimism
        },
        {
          hash: '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex,
          prover: '0x0000000000000000000000000000000000000002' as Hex, // Different prover
          chainId: 1, // Ethereum
          destinationChainId: 10, // Optimism
        },
      ]
      
      // Set up mock data
      indexerService.getNextSendBatch = jest.fn().mockResolvedValue(realSendBatchData)
      
      // Mock the hyperlane utilities for this test
      jest.spyOn(Hyperlane, 'getMessageData').mockReturnValue('0x1234123412341234123412341234123412341234123412341234123412341234' as Hex)
      jest.spyOn(Hyperlane, 'getMetadata').mockReturnValue('0x0000000000000000000000000000000000000000000000000000000000000000' as Hex)
      jest.spyOn(Hyperlane, 'estimateFee').mockResolvedValue(BigInt(1000))
      
      // Mock wallet client with transaction tracing capability
      const transactionHashesReceived: string[] = []
      const mockWalletClient = {
        sendTransaction: jest.fn().mockImplementation((params) => {
          // Verify transaction shape
          expect(params).toHaveProperty('to')
          expect(params).toHaveProperty('value')
          expect(params).toHaveProperty('data')
          
          // Use a fixed transaction hash to avoid randomness
          const txHash = '0x4444444444444444444444444444444444444444444444444444444444444444' as Hex
          transactionHashesReceived.push(txHash)
          return Promise.resolve(txHash)
        }),
      }
      
      const mockPublicClient = {
        waitForTransactionReceipt: jest.fn().mockResolvedValue({
          status: 'success',
          blockNumber: BigInt(1234567),
          transactionHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
        }),
        chain: { id: 10 }, // destination chain
        readContract: jest.fn().mockResolvedValue(BigInt(50000)),
      }
      
      walletClientService.getClient = jest.fn().mockResolvedValue(mockWalletClient)
      walletClientService.getPublicClient = jest.fn().mockResolvedValue(mockPublicClient)
      
      // Also mock getSendBatchTransaction to handle this more directly
      jest.spyOn(service as any, 'getSendBatchTransaction').mockImplementation(async () => {
        return {
          to: '0x2222222222222222222222222222222222222222' as Hex,
          value: BigInt(1000),
          data: '0x1234123412341234123412341234123412341234123412341234123412341234' as Hex,
        }
      })
      
      // Run the full end-to-end flow
      await service.getNextSendBatch()
      
      // Verify transaction flow
      // 1. Should have called indexer to get send batches
      expect(indexerService.getNextSendBatch).toHaveBeenCalledWith('0x1111111111111111111111111111111111111111')
      
      // 2. Should have created send batch jobs
      expect(mockIntentProcessorQueue.addExecuteSendBatchJobs).toHaveBeenCalled()
      
      // 3. Should have processed send batches
      // Note: We're using a mock queue that directly executes the service method
      expect(walletClientService.getClient).toHaveBeenCalledWith(10) // destination chain id
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalled()
      
      // 4. Verify a transaction was sent
      expect(transactionHashesReceived.length).toBeGreaterThan(0)
    })
    
    it('should handle large batches by chunking them properly', async () => {
      // Create a large batch of items with proper Hex addresses
      const largeBatch = Array(20).fill(0).map((_, idx) => ({
        hash: `0x${idx.toString().padStart(64, '0')}` as Hex,
        prover: idx % 2 === 0 
          ? '0x0000000000000000000000000000000000000001' as Hex 
          : '0x0000000000000000000000000000000000000002' as Hex, // Mix of provers
        chainId: 1,
        destinationChainId: 10,
      }))
      
      indexerService.getNextSendBatch = jest.fn().mockResolvedValue(largeBatch)
      
      // Modify config to use a small chunk size
      service['config'].sendBatch.chunkSize = 5
      
      // Capture created jobs to verify chunking
      const createdJobs: any[] = []
      mockIntentProcessorQueue.addExecuteSendBatchJobs = jest.fn().mockImplementation(async (jobsData) => {
        createdJobs.push(...jobsData)
        return Promise.resolve()
      })
      
      await service.getNextSendBatch()
      
      // Should have created multiple chunks
      expect(createdJobs.length).toBeGreaterThan(1)
      
      // Each chunk should respect the chunk size limit
      createdJobs.forEach(job => {
        expect(job.proves.length).toBeLessThanOrEqual(5)
      })
      
      // Should have preserved the grouping by prover
      const prover1Jobs = createdJobs.filter(job => 
        job.proves.some((prove: any) => prove.prover === '0x0000000000000000000000000000000000000001')
      )
      
      const prover2Jobs = createdJobs.filter(job => 
        job.proves.some((prove: any) => prove.prover === '0x0000000000000000000000000000000000000002')
      )
      
      expect(prover1Jobs.length).toBeGreaterThan(0)
      expect(prover2Jobs.length).toBeGreaterThan(0)
    })
    
    it('should handle empty send batches gracefully', async () => {
      // Mock empty batch response
      indexerService.getNextSendBatch = jest.fn().mockResolvedValue([])
      
      // Should complete without error
      await service.getNextSendBatch()
      
      // Verify indexer was still called
      expect(indexerService.getNextSendBatch).toHaveBeenCalledWith('0x1111111111111111111111111111111111111111')
      
      // No jobs should be created
      expect(mockIntentProcessorQueue.addExecuteSendBatchJobs).toHaveBeenCalledWith([])
    })
    
    it('should handle transaction errors during batch execution', async () => {
      // Create basic send batch data with proper Hex addresses
      const basicSendBatchData = [
        {
          hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
          prover: '0x0000000000000000000000000000000000000001' as Hex,
          chainId: 1,
          destinationChainId: 10,
        }
      ]
      
      // Set up mock data
      indexerService.getNextSendBatch = jest.fn().mockResolvedValue(basicSendBatchData)
      
      // Create separate error object
      const txError = new Error('Transaction failed: gas price too low')
      
      // Mock wallet client that fails with transaction error
      const mockWalletClient = {
        sendTransaction: jest.fn().mockImplementation(() => {
          return Promise.reject(txError)
        }),
      }
      
      const mockPublicClient = {
        waitForTransactionReceipt: jest.fn().mockResolvedValue({}),
        chain: { id: 10 },
      }
      
      walletClientService.getClient = jest.fn().mockResolvedValue(mockWalletClient)
      walletClientService.getPublicClient = jest.fn().mockResolvedValue(mockPublicClient)
      
      // Mock getSendBatchTransaction to return a valid transaction structure
      jest.spyOn(service as any, 'getSendBatchTransaction').mockResolvedValue({
        to: '0x2222222222222222222222222222222222222222' as Hex,
        value: BigInt(1000),
        data: '0x1234123412341234123412341234123412341234123412341234123412341234' as Hex,
      })
      
      // Flag to track error handling
      let errorWasCaught = false
      
      // Override normal queue behavior to capture errors instead of propagating them
      mockIntentProcessorQueue.addExecuteSendBatchJobs = jest.fn().mockImplementation(async (jobsData) => {
        // Call executeSendBatch directly, but catch errors
        try {
          for (const jobData of jobsData) {
            await service.executeSendBatch(jobData)
          }
        } catch (error) {
          // Mark that we caught an error
          errorWasCaught = true
        }
        return Promise.resolve()
      })
      
      // Should complete without error
      await service.getNextSendBatch()
      
      // Error should have been caught
      expect(errorWasCaught).toBe(true)
      
      // Should have tried to get client and execute transaction
      expect(walletClientService.getClient).toHaveBeenCalled()
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
      
      // Wait for receipt should not have been called
      expect(mockPublicClient.waitForTransactionReceipt).not.toHaveBeenCalled()
    })
  })
})