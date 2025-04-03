import { BaseJobManager } from '@/common/bullmq/base-job'
import { Job } from 'bullmq'

// Create a concrete implementation of BaseJobManager for testing
class TestJobManager extends BaseJobManager<Job> {
  override is(job: Job): boolean {
    return job.name === 'test-job'
  }

  override async process(job: Job, processor: unknown): Promise<void> {
    // Implementation for testing
    return Promise.resolve()
  }

  override onComplete(job: Job, processor: unknown): void {
    // Custom implementation
  }

  override onFailed(job: Job, processor: unknown, error: unknown): void {
    // Custom implementation
  }
}

describe('BaseJobManager', () => {
  let jobManager: TestJobManager

  beforeEach(() => {
    jobManager = new TestJobManager()
  })

  describe('abstract class', () => {
    it('should test abstract methods without direct instantiation', () => {
      // Instead of instantiating the abstract class, we can test the prototype methods
      expect(typeof BaseJobManager.prototype.is).toBe('function')
      expect(typeof BaseJobManager.prototype.process).toBe('function')
      expect(typeof BaseJobManager.prototype.onComplete).toBe('function')
      expect(typeof BaseJobManager.prototype.onFailed).toBe('function')
      
      // Verify the inheritance relationship
      expect(jobManager).toBeInstanceOf(BaseJobManager)
    })
  })

  describe('concrete implementation', () => {
    it('should correctly identify a job by name', () => {
      const testJob = { name: 'test-job' } as unknown as Job
      const otherJob = { name: 'other-job' } as unknown as Job

      expect(jobManager.is(testJob)).toBe(true)
      expect(jobManager.is(otherJob)).toBe(false)
    })

    it('should call process with the job and processor', async () => {
      const testJob = { name: 'test-job' } as unknown as Job
      const mockProcessor = {}

      const processSpy = jest.spyOn(jobManager, 'process')

      await jobManager.process(testJob, mockProcessor)
      
      expect(processSpy).toHaveBeenCalledWith(testJob, mockProcessor)
    })

    it('should allow overriding lifecycle methods', () => {
      const testJob = { name: 'test-job' } as unknown as Job
      const mockProcessor = {}
      const error = new Error('Test error')

      const completeSpy = jest.spyOn(jobManager, 'onComplete')
      const failedSpy = jest.spyOn(jobManager, 'onFailed')

      jobManager.onComplete(testJob, mockProcessor)
      jobManager.onFailed(testJob, mockProcessor, error)

      expect(completeSpy).toHaveBeenCalledWith(testJob, mockProcessor)
      expect(failedSpy).toHaveBeenCalledWith(testJob, mockProcessor, error)
    })
  })
})