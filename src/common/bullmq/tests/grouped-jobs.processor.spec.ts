import { GroupedJobsProcessor } from '@/common/bullmq/grouped-jobs.processor'
import { BaseJobManager } from '@/common/bullmq/base-job'
import { Job, Queue } from 'bullmq'
import { Logger } from '@nestjs/common'

// Create concrete implementations for testing
class TestGroupJob extends Job {
  data: {
    groupKey?: string
    value?: number
  }
}

class TestJobManager extends BaseJobManager<TestGroupJob> {
  override is(job: TestGroupJob): boolean {
    return job.name === 'test-group-job'
  }

  override async process(job: TestGroupJob, processor: unknown): Promise<void> {
    return Promise.resolve()
  }
}

class TestGroupedProcessor extends GroupedJobsProcessor<TestGroupJob, TestJobManager> {
  // Public accessor to activeGroups for testing
  getActiveGroups(): Set<string> {
    return this.activeGroups
  }

  // Implement abstract methods/properties
  protected override readonly queue: Queue

  getJobManagers(): TestJobManager[] {
    return [this.jobManager]
  }

  constructor(groupBy: string, queue: Queue, private readonly jobManager: TestJobManager) {
    super(groupBy as any, 'test-grouped-processor', [jobManager])
    this.queue = queue
  }
}

describe('GroupedJobsProcessor', () => {
  let processor: TestGroupedProcessor
  let jobManager: TestJobManager
  let mockQueue: Queue
  let mockJob: TestGroupJob

  beforeEach(() => {
    // Setup mocks
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})

    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    } as unknown as Queue

    jobManager = new TestJobManager()
    processor = new TestGroupedProcessor('groupKey', mockQueue, jobManager)
    
    // Create a mock job
    mockJob = {
      name: 'test-group-job',
      data: {
        groupKey: 'test-group',
        value: 123,
      },
      moveToDelayed: jest.fn().mockResolvedValue({}),
      returnvalue: {},
    } as unknown as TestGroupJob
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('process method', () => {
    it('should process job when group is not active', async () => {
      const spy = jest.spyOn(jobManager, 'process').mockResolvedValue()

      await processor.process(mockJob)

      expect(spy).toHaveBeenCalledWith(mockJob, processor)
      expect(processor.getActiveGroups().has('test-group')).toBe(true)
    })

    it('should delay job when group is already active', async () => {
      // Set the group as active
      processor.getActiveGroups().add('test-group')
      
      // Mock the job object with opts needed for queue.add
      mockJob.opts = {}
      
      // Process the job
      const result = await processor.process(mockJob)

      // The queue.add method should be called to reschedule the job
      expect(mockQueue.add).toHaveBeenCalled()
      
      // The return value should indicate the job was delayed
      expect(result).toEqual({ delayed: true })
    })

    it('should not attempt to delay job without a group key', async () => {
      const jobWithoutGroup = {
        ...mockJob,
        data: { value: 123 },
        opts: {},
      } as unknown as TestGroupJob

      const spy = jest.spyOn(jobManager, 'process').mockResolvedValue()
      
      // Reset the add method call counter
      jest.clearAllMocks();

      await processor.process(jobWithoutGroup)

      // Should not try to add a delayed job
      expect(mockQueue.add).not.toHaveBeenCalled()
      expect(spy).toHaveBeenCalledWith(jobWithoutGroup, processor)
    })
  })

  describe('event handlers', () => {
    it('should remove group from active groups when job completes', () => {
      // Set the group as active
      processor.getActiveGroups().add('test-group')
      
      // Call the onWorkerEvent handler
      const handler = processor['onCompleted']
      handler.call(processor, mockJob)

      expect(processor.getActiveGroups().has('test-group')).toBe(false)
    })

    it('should not call onComplete hook for delayed jobs', () => {
      // Set the group as active
      processor.getActiveGroups().add('test-group')
      
      // Set the job as delayed
      const delayedJob = {
        ...mockJob,
        returnvalue: { delayed: true },
      } as unknown as TestGroupJob

      const spy = jest.spyOn(jobManager, 'onComplete')
      
      // Call the onWorkerEvent handler
      const handler = processor['onCompleted']
      handler.call(processor, delayedJob)

      expect(spy).not.toHaveBeenCalled()
      // Group should still be active
      expect(processor.getActiveGroups().has('test-group')).toBe(true)
    })

    it('should remove group from active groups when job fails', () => {
      // Set the group as active
      processor.getActiveGroups().add('test-group')
      
      // Call the onWorkerEvent handler
      const handler = processor['onFailed']
      handler.call(processor, mockJob, new Error('Job failed'))

      expect(processor.getActiveGroups().has('test-group')).toBe(false)
    })

    it('should not remove non-existent group when job fails without a group', () => {
      const jobWithoutGroup = {
        ...mockJob,
        data: { value: 123 },
      } as unknown as TestGroupJob

      // Call the onWorkerEvent handler
      const handler = processor['onFailed']
      handler.call(processor, jobWithoutGroup, new Error('Job failed'))

      // Should not throw
      expect(processor.getActiveGroups().size).toBe(0)
    })
  })
})