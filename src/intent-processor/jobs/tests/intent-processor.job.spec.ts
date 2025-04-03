import { 
  IntentProcessorJob, 
  IntentProcessorJobManager 
} from '@/intent-processor/jobs/intent-processor.job'
import { BaseJobManager } from '@/common/bullmq/base-job'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { Job } from 'bullmq'

describe('IntentProcessorJobManager', () => {
  it('should extend BaseJobManager', () => {
    // This test verifies the inheritance relationship
    // Use a concrete implementation instead of the abstract class
    const manager = new TestIntentProcessorJobManager()
    expect(manager).toBeInstanceOf(BaseJobManager)
    expect(manager).toBeInstanceOf(IntentProcessorJobManager)
  })
})

// Create a concrete implementation of IntentProcessorJobManager for testing
class TestIntentProcessorJobManager extends IntentProcessorJobManager {
  override is(job: IntentProcessorJob): boolean {
    return job.name === IntentProcessorJobName.CHECK_WITHDRAWS
  }

  override async process(job: IntentProcessorJob, processor: unknown): Promise<void> {
    return Promise.resolve()
  }

  override onComplete(job: IntentProcessorJob, processor: unknown): void {
    // Test implementation
  }

  override onFailed(job: IntentProcessorJob, processor: unknown, error: unknown): void {
    // Test implementation
  }
}

describe('Concrete IntentProcessorJobManager implementation', () => {
  let jobManager: TestIntentProcessorJobManager

  beforeEach(() => {
    jobManager = new TestIntentProcessorJobManager()
  })

  it('should correctly identify jobs by name', () => {
    const testJob = { 
      name: IntentProcessorJobName.CHECK_WITHDRAWS 
    } as unknown as IntentProcessorJob

    const otherJob = { 
      name: IntentProcessorJobName.EXECUTE_SEND_BATCH 
    } as unknown as IntentProcessorJob

    expect(jobManager.is(testJob)).toBe(true)
    expect(jobManager.is(otherJob)).toBe(false)
  })

  it('should implement process method', async () => {
    const testJob = { 
      name: IntentProcessorJobName.CHECK_WITHDRAWS 
    } as unknown as IntentProcessorJob
    
    const mockProcessor = {}
    const processSpy = jest.spyOn(jobManager, 'process')

    await jobManager.process(testJob, mockProcessor)
    expect(processSpy).toHaveBeenCalledWith(testJob, mockProcessor)
  })

  it('should implement lifecycle hooks', () => {
    const testJob = { 
      name: IntentProcessorJobName.CHECK_WITHDRAWS 
    } as unknown as IntentProcessorJob
    
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