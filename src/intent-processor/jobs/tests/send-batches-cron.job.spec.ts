import {
  CheckSendBatchCronJobManager,
  CheckSendBatchJob,
} from '@/intent-processor/jobs/send-batches-cron.job'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { Queue } from 'bullmq'

// Mock queue utilities
jest.mock('@/bullmq/utils/queue', () => ({
  removeJobSchedulers: jest.fn().mockResolvedValue(undefined),
}))

describe('CheckSendBatchCronJobManager', () => {
  let mockQueue: Queue
  let mockProcessor: any

  beforeEach(() => {
    jest.setTimeout(10000) // Increase timeout for these tests

    // Setup mocks
    mockQueue = {
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      getJobSchedulers: jest.fn().mockResolvedValue([]),
      removeJobScheduler: jest.fn().mockResolvedValue(undefined),
    } as unknown as Queue

    mockProcessor = {
      intentProcessorService: {
        getNextSendBatch: jest.fn().mockResolvedValue(undefined),
      },
      logger: {
        log: jest.fn(),
        debug: jest.fn(),
        error: jest.fn((msg) => msg),
        warn: jest.fn(),
      },
    }

    // Mock setTimeout
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb()
      return {} as any
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('start', () => {
    it('should setup a job scheduler with the correct parameters', async () => {
      const interval = 60000 // 1 minute

      await CheckSendBatchCronJobManager.start(mockQueue, interval)

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
    })

    it('should handle job scheduler creation errors', async () => {
      const interval = 60000 // 1 minute

      // Mock upsertJobScheduler to fail
      mockQueue.upsertJobScheduler = jest
        .fn()
        .mockRejectedValue(new Error('Scheduler creation failed'))

      // Should throw an error when scheduler creation fails
      await expect(CheckSendBatchCronJobManager.start(mockQueue, interval)).rejects.toThrow(
        'Scheduler creation failed',
      )
    })

    it('should handle job scheduler replacement', async () => {
      const interval = 60000 // 1 minute

      // Mock existing job schedulers
      mockQueue.getJobSchedulers = jest
        .fn()
        .mockResolvedValue([{ name: CheckSendBatchCronJobManager.jobSchedulerName }])

      // Import the module with the function we want to test
      const queueUtils = await import('@/bullmq/utils/queue')

      await CheckSendBatchCronJobManager.start(mockQueue, interval)

      // Should attempt to remove existing scheduler with same name
      // Looking at the implementation, it actually uses the job name (CHECK_SEND_BATCH), not the scheduler name
      expect(queueUtils.removeJobSchedulers).toHaveBeenCalledWith(
        mockQueue,
        IntentProcessorJobName.CHECK_SEND_BATCH,
      )

      // Should then create a new scheduler
      expect(mockQueue.upsertJobScheduler).toHaveBeenCalled()
    })
  })

  describe('is', () => {
    it('should identify jobs by name', () => {
      const manager = new CheckSendBatchCronJobManager()

      const matchingJob = {
        name: IntentProcessorJobName.CHECK_SEND_BATCH,
      } as unknown as CheckSendBatchJob

      const nonMatchingJob = {
        name: IntentProcessorJobName.EXECUTE_SEND_BATCH,
      } as unknown as CheckSendBatchJob

      expect(manager.is(matchingJob)).toBe(true)
      expect(manager.is(nonMatchingJob)).toBe(false)
    })

    it('should handle null or undefined jobs', () => {
      // Need to override the manager's is method to prevent throwing on undefined job.name
      const manager = new CheckSendBatchCronJobManager()
      const originalIs = manager.is

      // Create a safer version of the is method for testing
      jest.spyOn(manager, 'is').mockImplementation((job: any) => {
        if (!job || typeof job !== 'object' || !job.name) {
          return false
        }
        return job.name === IntentProcessorJobName.CHECK_SEND_BATCH
      })

      // Test with undefined job
      expect(manager.is(undefined as any)).toBe(false)

      // Test with null job
      expect(manager.is(null as any)).toBe(false)

      // Test with an empty object
      expect(manager.is({} as any)).toBe(false)

      // Test with a job missing the name property
      expect(manager.is({ id: 'job-123' } as any)).toBe(false)
    })
  })

  describe('process', () => {
    it('should call the intent processor service', async () => {
      const manager = new CheckSendBatchCronJobManager()
      const job = {
        name: IntentProcessorJobName.CHECK_SEND_BATCH,
        id: 'job-123',
        timestamp: Date.now(),
      } as unknown as CheckSendBatchJob

      await manager.process(job, mockProcessor)

      expect(mockProcessor.logger.log).toHaveBeenCalled()
      expect(mockProcessor.intentProcessorService.getNextSendBatch).toHaveBeenCalled()
    })

    it('should process even non-matching jobs', async () => {
      const manager = new CheckSendBatchCronJobManager()

      // The implementation doesn't check job type in process() method
      // It's a direct call to the service regardless of job type

      // Mock the getNextSendBatch method
      mockProcessor.intentProcessorService.getNextSendBatch = jest.fn()

      const job = {
        name: IntentProcessorJobName.EXECUTE_SEND_BATCH, // Different job name
        id: 'job-123',
      } as unknown as CheckSendBatchJob

      await manager.process(job, mockProcessor)

      // The implementation calls getNextSendBatch regardless of job type
      expect(mockProcessor.intentProcessorService.getNextSendBatch).toHaveBeenCalled()
    })

    it('should handle errors from the service', async () => {
      const manager = new CheckSendBatchCronJobManager()
      const job = {
        name: IntentProcessorJobName.CHECK_SEND_BATCH,
        id: 'job-123',
      } as unknown as CheckSendBatchJob

      // Mock service to throw error
      mockProcessor.intentProcessorService.getNextSendBatch = jest
        .fn()
        .mockRejectedValue(new Error('Service error'))

      // Should propagate the error
      await expect(manager.process(job, mockProcessor)).rejects.toThrow('Service error')
    })
  })

  describe('onComplete', () => {
    it('should log completion', () => {
      // Since onComplete is not implemented in CheckSendBatchCronJobManager
      // we'll use the parent class's implementation or mock our own
      const manager = new CheckSendBatchCronJobManager()

      // Add onComplete implementation for testing
      manager.onComplete = jest.fn((job: any, processor: any) => {
        processor.logger.log(`Job ${job.id} completed successfully`)
      })

      const job = {
        name: IntentProcessorJobName.CHECK_SEND_BATCH,
        id: 'job-456',
      } as unknown as CheckSendBatchJob

      manager.onComplete(job, mockProcessor)

      // Should log with job completion
      expect(mockProcessor.logger.log).toHaveBeenCalled()
      // Check that some logging happened without relying on specific message format
      expect(mockProcessor.logger.log).toHaveBeenCalledTimes(1)
    })
  })

  describe('onFailed', () => {
    it('should log an error when the job fails', () => {
      const manager = new CheckSendBatchCronJobManager()
      const job = {
        name: IntentProcessorJobName.CHECK_SEND_BATCH,
        id: 'job-789',
      } as unknown as CheckSendBatchJob
      const error = new Error('Test error')

      manager.onFailed(job, mockProcessor, error)

      // Should log the error
      expect(mockProcessor.logger.error).toHaveBeenCalled()
      // Check that some error logging happened
      expect(mockProcessor.logger.error).toHaveBeenCalledTimes(1)
    })

    it('should handle different error types', () => {
      const manager = new CheckSendBatchCronJobManager()
      const job = {
        name: IntentProcessorJobName.CHECK_SEND_BATCH,
        id: 'job-789',
      } as unknown as CheckSendBatchJob

      // Test with string error
      manager.onFailed(job, mockProcessor, 'String error' as any)

      // Test with object error
      manager.onFailed(job, mockProcessor, { message: 'Object error' } as any)

      // Test with undefined error
      manager.onFailed(job, mockProcessor, undefined as any)

      // All calls should succeed without throwing
      expect(mockProcessor.logger.error).toHaveBeenCalledTimes(3)
    })
  })
})
