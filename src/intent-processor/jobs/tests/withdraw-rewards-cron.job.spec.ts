import {
  CheckWithdrawalsCronJobManager,
  CheckWithdrawsCronJob,
} from '@/intent-processor/jobs/withdraw-rewards-cron.job'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { Queue } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

// Mock queue utilities
jest.mock('@/bullmq/utils/queue', () => ({
  removeJobSchedulers: jest.fn().mockResolvedValue(undefined),
}))

describe('CheckWithdrawalsCronJobManager', () => {
  let mockQueue: Queue
  let mockProcessor: any

  beforeEach(() => {
    jest.setTimeout(10000) // Increase timeout for these tests

    // Setup mocks
    mockQueue = {
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    } as unknown as Queue

    mockProcessor = {
      intentProcessorService: {
        getNextBatchWithdrawals: jest.fn().mockResolvedValue(undefined),
      },
      logger: {
        log: jest.fn(),
        error: jest.fn((msg) => msg),
      },
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('start', () => {
    it('should setup a job scheduler with the correct parameters', async () => {
      const interval = 60000 // 1 minute

      // Mock setTimeout
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb()
        return {} as any
      })

      await CheckWithdrawalsCronJobManager.start(mockQueue, interval)

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
    })
  })

  describe('is', () => {
    it('should identify jobs by name', () => {
      const manager = new CheckWithdrawalsCronJobManager()

      const matchingJob = {
        name: IntentProcessorJobName.CHECK_WITHDRAWS,
      } as unknown as CheckWithdrawsCronJob

      const nonMatchingJob = {
        name: IntentProcessorJobName.EXECUTE_WITHDRAWS,
      } as unknown as CheckWithdrawsCronJob

      expect(manager.is(matchingJob)).toBe(true)
      expect(manager.is(nonMatchingJob)).toBe(false)
    })
  })

  describe('process', () => {
    it('should call the intent processor service', async () => {
      const manager = new CheckWithdrawalsCronJobManager()
      const job = {
        name: IntentProcessorJobName.CHECK_WITHDRAWS,
      } as unknown as CheckWithdrawsCronJob

      await manager.process(job, mockProcessor)

      expect(mockProcessor.logger.log).toHaveBeenCalled()
      expect(mockProcessor.intentProcessorService.getNextBatchWithdrawals).toHaveBeenCalled()
    })
  })

  describe('onFailed', () => {
    it('should log an error when the job fails', () => {
      const manager = new CheckWithdrawalsCronJobManager()
      const job = {
        name: IntentProcessorJobName.CHECK_WITHDRAWS,
      } as unknown as CheckWithdrawsCronJob

      const error = new Error('Test error')

      // Setup spy on EcoLogMessage
      const spy = jest.spyOn(EcoLogMessage, 'fromDefault').mockReturnValue({
        message: 'CheckWithdrawalsCronJobManager: Failed',
        properties: { error: 'Test error' },
      } as any)

      manager.onFailed(job, mockProcessor, error)

      // Verify the mock was called
      expect(spy).toHaveBeenCalled()
      expect(mockProcessor.logger.error).toHaveBeenCalled()

      // Check the message
      const mockCall = spy.mock.calls[0]
      if (mockCall && mockCall[0]) {
        expect(mockCall[0].message).toContain('Failed')
        // Check that properties exists and has an error property
        if (mockCall[0].properties && typeof mockCall[0].properties === 'object') {
          expect(mockCall[0].properties['error']).toBe('Test error')
        }
      }
    })
  })
})
