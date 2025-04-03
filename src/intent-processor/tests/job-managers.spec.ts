import { Queue } from 'bullmq'
import { createMock } from '@golevelup/ts-jest'
import { Hex } from 'viem'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'

// Mock the queue utils first
jest.mock('@/bullmq/utils/queue', () => ({
  removeJobSchedulers: jest.fn().mockResolvedValue(undefined),
}))

// Then import the modules that use these utils
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { CheckSendBatchCronJobManager } from '@/intent-processor/jobs/send-batches-cron.job'
import { CheckWithdrawalsCronJobManager } from '@/intent-processor/jobs/withdraw-rewards-cron.job'
import { ExecuteWithdrawsJobManager } from '@/intent-processor/jobs/execute-withdraws.job'
import { ExecuteSendBatchJobManager } from '@/intent-processor/jobs/execute-send-batch.job'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'

// Access the mock
const mockRemoveJobSchedulers = jest.mocked(require('@/bullmq/utils/queue').removeJobSchedulers)

describe('Intent Processor Job Managers', () => {
  // Common mocks used by all tests
  let mockQueue: Queue
  let mockProcessor: IntentProcessor

  beforeEach(() => {
    jest.clearAllMocks()

    // Create a mock Queue
    mockQueue = {
      add: jest.fn().mockResolvedValue(undefined),
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getActive: jest.fn().mockResolvedValue([]),
    } as unknown as Queue

    // Create a mock of IntentProcessorService
    const mockIntentProcessorService = createMock<IntentProcessorService>({
      getNextBatchWithdrawals: jest.fn().mockResolvedValue(undefined),
      getNextSendBatch: jest.fn().mockResolvedValue(undefined),
      executeWithdrawals: jest.fn().mockResolvedValue(undefined),
      executeSendBatch: jest.fn().mockResolvedValue(undefined),
    })

    // Create a mock of IntentProcessor
    mockProcessor = {
      intentProcessorService: mockIntentProcessorService,
      queue: mockQueue,
      logger: {
        log: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        verbose: jest.fn(),
      },
    } as unknown as IntentProcessor
  })

  describe('CheckWithdrawalsCronJobManager', () => {
    it('should be initialized correctly', () => {
      const manager = new CheckWithdrawalsCronJobManager()
      expect(manager).toBeDefined()
    })

    // Add timeout to avoid test timeout
    it('should start the job scheduler with the correct interval', async () => {
      const interval = 60000 // 1 minute

      // Directly mock the delay to avoid the actual timeout
      // Instead of mocking setTimeout, we'll modify the implementation of withdraw-rewards-cron.job.ts
      // This is done by spying on Promise.all to immediately return
      jest.spyOn(Promise, 'all').mockImplementation(() => Promise.resolve([]))

      // Call the static start method
      await CheckWithdrawalsCronJobManager.start(mockQueue, interval)

      // Should call removeJobSchedulers to clean up existing job schedulers
      expect(mockRemoveJobSchedulers).toHaveBeenCalledWith(
        mockQueue,
        IntentProcessorJobName.CHECK_WITHDRAWS,
      )

      // Should call upsertJobScheduler with the correct parameters
      expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
        CheckWithdrawalsCronJobManager.jobSchedulerName,
        { every: interval },
        {
          name: IntentProcessorJobName.CHECK_WITHDRAWS,
          opts: {
            removeOnComplete: true,
          },
        },
      )

      // Restore Promise.all
      jest.restoreAllMocks()
    }, 10000)

    it('should identify its job correctly', () => {
      const manager = new CheckWithdrawalsCronJobManager()

      // Create a job with the CHECK_WITHDRAWS name
      const checkWithdrawsJob = { name: IntentProcessorJobName.CHECK_WITHDRAWS }
      // Create a job with a different name
      const otherJob = { name: IntentProcessorJobName.CHECK_SEND_BATCH }

      // The manager should identify its own job type
      expect(manager.is(checkWithdrawsJob as any)).toBe(true)
      expect(manager.is(otherJob as any)).toBe(false)
    })

    it('should process withdrawals by calling intentProcessorService', async () => {
      const manager = new CheckWithdrawalsCronJobManager()
      const job = { name: IntentProcessorJobName.CHECK_WITHDRAWS }

      // Process the job
      await manager.process(job as any, mockProcessor)

      // Should call the service method to get the next batch of withdrawals
      expect(mockProcessor.intentProcessorService.getNextBatchWithdrawals).toHaveBeenCalled()
    })

    it('should handle job failure correctly', () => {
      const manager = new CheckWithdrawalsCronJobManager()
      const job = { name: IntentProcessorJobName.CHECK_WITHDRAWS }
      const error = new Error('Test error')

      // Simulate job failure
      manager.onFailed(job as any, mockProcessor, error)

      // Should log the error
      expect(mockProcessor.logger.error).toHaveBeenCalled()
    })
  })

  describe('CheckSendBatchCronJobManager', () => {
    it('should be initialized correctly', () => {
      const manager = new CheckSendBatchCronJobManager()
      expect(manager).toBeDefined()
    })

    // Add timeout to avoid test timeout
    it('should start the job scheduler with the correct interval', async () => {
      const interval = 120000 // 2 minutes

      // This job manager doesn't use setTimeout so no need to mock it

      // Call the static start method
      await CheckSendBatchCronJobManager.start(mockQueue, interval)

      // Should call removeJobSchedulers to clean up existing job schedulers
      expect(mockRemoveJobSchedulers).toHaveBeenCalledWith(
        mockQueue,
        IntentProcessorJobName.CHECK_SEND_BATCH,
      )

      // Should call upsertJobScheduler with the correct parameters
      expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
        CheckSendBatchCronJobManager.jobSchedulerName,
        { every: interval },
        {
          name: IntentProcessorJobName.CHECK_SEND_BATCH,
          opts: {
            removeOnComplete: true,
          },
        },
      )
    }, 10000)

    it('should identify its job correctly', () => {
      const manager = new CheckSendBatchCronJobManager()

      // Create a job with the CHECK_SEND_BATCH name
      const checkSendBatchJob = { name: IntentProcessorJobName.CHECK_SEND_BATCH }
      // Create a job with a different name
      const otherJob = { name: IntentProcessorJobName.CHECK_WITHDRAWS }

      // The manager should identify its own job type
      expect(manager.is(checkSendBatchJob as any)).toBe(true)
      expect(manager.is(otherJob as any)).toBe(false)
    })

    it('should process send batches by calling intentProcessorService', async () => {
      const manager = new CheckSendBatchCronJobManager()
      const job = { name: IntentProcessorJobName.CHECK_SEND_BATCH }

      // Process the job
      await manager.process(job as any, mockProcessor)

      // Should call the service method to get the next send batch
      expect(mockProcessor.intentProcessorService.getNextSendBatch).toHaveBeenCalled()
    })

    it('should handle job failure correctly', () => {
      const manager = new CheckSendBatchCronJobManager()
      const job = { name: IntentProcessorJobName.CHECK_SEND_BATCH }
      const error = new Error('Test error')

      // Simulate job failure
      manager.onFailed(job as any, mockProcessor, error)

      // Should log the error
      expect(mockProcessor.logger.error).toHaveBeenCalled()
    })
  })

  describe('ExecuteWithdrawsJobManager', () => {
    it('should create a job with correct parameters', () => {
      // Create job data for testing
      const jobData = {
        chainId: 1,
        intentSourceAddr: '0x1111111111111111111111111111111111111111' as Hex,
        intents: [
          {
            routeHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
            reward: {
              creator: '0x3333333333333333333333333333333333333333' as Hex,
              prover: '0x4444444444444444444444444444444444444444' as Hex,
              deadline: BigInt(1234567890),
              nativeValue: BigInt(1000000000000000000),
              tokens: [],
            },
          },
        ],
      }

      // Call the static createJob method
      const result = ExecuteWithdrawsJobManager.createJob(jobData)

      // Verify the result
      expect(result.name).toBe(IntentProcessorJobName.EXECUTE_WITHDRAWS)
      expect(result.opts).toBeDefined()
      expect(result.opts!.jobId).toBeDefined() // Should generate a jobId from intent hashes
      expect(result.opts!.attempts).toBe(3) // Should set retry attempts
      expect(result.opts!.backoff).toEqual({
        type: 'exponential',
        delay: 1000,
      })
      // Data should be serialized
      expect(result.data).toBeDefined()
    })

    it('should identify its job correctly', () => {
      const manager = new ExecuteWithdrawsJobManager()

      // Create a job with the EXECUTE_WITHDRAWS name
      const executeWithdrawsJob = { name: IntentProcessorJobName.EXECUTE_WITHDRAWS }
      // Create a job with a different name
      const otherJob = { name: IntentProcessorJobName.EXECUTE_SEND_BATCH }

      // The manager should identify its own job type
      expect(manager.is(executeWithdrawsJob as any)).toBe(true)
      expect(manager.is(otherJob as any)).toBe(false)
    })

    it('should process withdrawals by calling intentProcessorService', async () => {
      const manager = new ExecuteWithdrawsJobManager()

      // Mock job with serialized data
      const mockData = {
        chainId: 1,
        intentSourceAddr: '0x1111111111111111111111111111111111111111',
        intents: [{ routeHash: '0xroute1', reward: {} }],
      }

      // Mock serialization utilities
      jest.mock('@/common/utils/serialize', () => ({
        serialize: jest.fn().mockImplementation((data) => JSON.stringify(data)),
        deserialize: jest.fn().mockImplementation((data) => JSON.parse(data)),
      }))

      // Create a job with the EXECUTE_WITHDRAWS name and serialized data
      const job = {
        name: IntentProcessorJobName.EXECUTE_WITHDRAWS,
        data: JSON.stringify(mockData),
      }

      // Process the job
      await manager.process(job as any, mockProcessor)

      // Should call the service method to execute withdrawals
      expect(mockProcessor.intentProcessorService.executeWithdrawals).toHaveBeenCalled()
    })

    it('should handle job failure correctly', () => {
      const manager = new ExecuteWithdrawsJobManager()
      const job = { name: IntentProcessorJobName.EXECUTE_WITHDRAWS }
      const error = new Error('Test error')

      // Simulate job failure
      manager.onFailed(job as any, mockProcessor, error)

      // Should log the error
      expect(mockProcessor.logger.error).toHaveBeenCalled()
    })
  })

  describe('ExecuteSendBatchJobManager', () => {
    it('should create a job with correct parameters', () => {
      // Create job data for testing
      const jobData = {
        chainId: 10,
        proves: [
          {
            hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
            prover: '0x2222222222222222222222222222222222222222' as Hex,
            source: 1,
          },
        ],
      }

      // Call the static createJob method
      const result = ExecuteSendBatchJobManager.createJob(jobData)

      // Verify the result
      expect(result.name).toBe(IntentProcessorJobName.EXECUTE_SEND_BATCH)
      expect(result.opts).toBeDefined()
      expect(result.opts!.jobId).toBeDefined() // Should generate a jobId from intent hashes
      expect(result.opts!.attempts).toBe(3) // Should set retry attempts
      expect(result.opts!.backoff).toEqual({
        type: 'exponential',
        delay: 1000,
      })
      // Data should be serialized
      expect(result.data).toBeDefined()
    })

    it('should identify its job correctly', () => {
      const manager = new ExecuteSendBatchJobManager()

      // Create a job with the EXECUTE_SEND_BATCH name
      const executeSendBatchJob = { name: IntentProcessorJobName.EXECUTE_SEND_BATCH }
      // Create a job with a different name
      const otherJob = { name: IntentProcessorJobName.EXECUTE_WITHDRAWS }

      // The manager should identify its own job type
      expect(manager.is(executeSendBatchJob as any)).toBe(true)
      expect(manager.is(otherJob as any)).toBe(false)
    })

    it('should process send batches by calling intentProcessorService', async () => {
      const manager = new ExecuteSendBatchJobManager()

      // Mock job with serialized data
      const mockData = {
        chainId: 10,
        proves: [
          {
            hash: '0xbatch1',
            prover: '0xprover1',
            source: 1,
          },
        ],
      }

      // Mock serialization utilities
      jest.mock('@/common/utils/serialize', () => ({
        serialize: jest.fn().mockImplementation((data) => JSON.stringify(data)),
        deserialize: jest.fn().mockImplementation((data) => JSON.parse(data)),
      }))

      // Create a job with the EXECUTE_SEND_BATCH name and serialized data
      const job = {
        name: IntentProcessorJobName.EXECUTE_SEND_BATCH,
        data: JSON.stringify(mockData),
      }

      // Process the job
      await manager.process(job as any, mockProcessor)

      // Should call the service method to execute send batch
      expect(mockProcessor.intentProcessorService.executeSendBatch).toHaveBeenCalled()
    })

    it('should handle job failure correctly', () => {
      const manager = new ExecuteSendBatchJobManager()
      const job = { name: IntentProcessorJobName.EXECUTE_SEND_BATCH }
      const error = new Error('Test error')

      // Simulate job failure
      manager.onFailed(job as any, mockProcessor, error)

      // Should log the error
      expect(mockProcessor.logger.error).toHaveBeenCalled()
    })
  })
})
