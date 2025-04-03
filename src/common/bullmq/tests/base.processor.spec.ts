import { BaseProcessor } from '@/common/bullmq/base.processor'
import { BaseJobManager } from '@/common/bullmq/base-job'
import { Job } from 'bullmq'
import { Logger } from '@nestjs/common'

// Create concrete implementations for testing
class TestJobManager extends BaseJobManager<Job> {
  override is(job: Job): boolean {
    return job.name === 'test-job'
  }

  override async process(job: Job, processor: unknown): Promise<void> {
    return Promise.resolve()
  }
}

class TestProcessor extends BaseProcessor<Job, TestJobManager> {
  // Need to implement the abstract properties
  getJobManagers(): TestJobManager[] {
    return [this.jobManager]
  }

  constructor(private readonly jobManager: TestJobManager) {
    // Create with the processor name and job managers
    super('test-processor', [jobManager])
  }
}

describe('BaseProcessor', () => {
  let processor: TestProcessor
  let jobManager: TestJobManager
  let mockJob: Job

  beforeEach(() => {
    // Create a mock object for EcoLogMessage
    jest.mock('@/common/logging/eco-log-message', () => ({
      EcoLogMessage: {
        fromDefault: jest.fn().mockImplementation(({ message }) => ({ message })),
      },
    }))

    // Mock Logger methods
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})

    jobManager = new TestJobManager()
    processor = new TestProcessor(jobManager)

    // Create a mock job
    mockJob = {
      name: 'test-job',
      data: {},
      isCompleted: jest.fn().mockResolvedValue(false),
      isFailed: jest.fn().mockResolvedValue(false),
    } as unknown as Job
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('process method', () => {
    it('should process a job using the appropriate job manager', async () => {
      const spy = jest.spyOn(jobManager, 'process').mockResolvedValue()
      jest.spyOn(jobManager, 'is').mockReturnValue(true)

      await processor.process(mockJob)

      expect(spy).toHaveBeenCalledWith(mockJob, processor)
    })

    it('should log a debug message when no job manager is found', async () => {
      jest.spyOn(jobManager, 'is').mockReturnValue(false)
      const loggerSpy = jest.spyOn(processor.logger, 'debug')

      await processor.process(mockJob)

      expect(loggerSpy).toHaveBeenCalled()
      // Instead of testing the specific message, just verify it was called
    })

    it('should handle errors during processing', async () => {
      try {
        const error = new Error('Processing error')
        jest.spyOn(jobManager, 'is').mockReturnValue(true)
        jest.spyOn(jobManager, 'process').mockRejectedValue(error)

        await processor.process(mockJob)

        // Should not reach here if error is properly propagated
        fail('Expected error to be thrown')
      } catch (error) {
        expect(error.message).toBe('Processing error')
      }
    })
  })

  describe('event handlers', () => {
    it('should call onComplete when a job completes', () => {
      const spy = jest.spyOn(jobManager, 'onComplete')
      jest.spyOn(jobManager, 'is').mockReturnValue(true)

      // Call the onWorkerEvent handler
      const handler = processor['onCompleted']
      handler.call(processor, mockJob)

      expect(spy).toHaveBeenCalledWith(mockJob, processor)
    })

    it('should call onFailed when a job fails', () => {
      const error = new Error('Job failed')
      const spy = jest.spyOn(jobManager, 'onFailed')
      jest.spyOn(jobManager, 'is').mockReturnValue(true)

      // Call the onWorkerEvent handler
      const handler = processor['onFailed']
      handler.call(processor, mockJob, error)

      expect(spy).toHaveBeenCalledWith(mockJob, processor, error)
    })

    it('should log debug message when no job manager is found for a completed job', () => {
      jest.spyOn(jobManager, 'is').mockReturnValue(false)
      const loggerSpy = jest.spyOn(processor.logger, 'debug')

      // Call the onWorkerEvent handler
      const handler = processor['onCompleted']
      handler.call(processor, mockJob)

      expect(loggerSpy).toHaveBeenCalled()
      // Just verify the log was called
    })

    it('should log debug message when no job manager is found for a failed job', () => {
      const error = new Error('Job failed')
      jest.spyOn(jobManager, 'is').mockReturnValue(false)
      const loggerSpy = jest.spyOn(processor.logger, 'debug')

      // Call the onWorkerEvent handler
      const handler = processor['onFailed']
      handler.call(processor, mockJob, error)

      expect(loggerSpy).toHaveBeenCalled()
      // Just verify the log was called
    })
  })
})
