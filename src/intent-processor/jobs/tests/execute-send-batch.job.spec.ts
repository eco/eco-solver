import { createMock } from '@golevelup/ts-jest'
import { Job } from 'bullmq'
import { Hex, keccak256, encodePacked } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { deserialize, serialize } from '@/common/utils/serialize'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'
import {
  ExecuteSendBatchJob,
  ExecuteSendBatchJobData,
  ExecuteSendBatchJobManager,
} from '@/intent-processor/jobs/execute-send-batch.job'

describe('ExecuteSendBatchJobManager', () => {
  let jobManager: ExecuteSendBatchJobManager
  let processor: IntentProcessor
  let intentProcessorService: IntentProcessorService

  beforeEach(() => {
    intentProcessorService = createMock<IntentProcessorService>()
    processor = createMock<IntentProcessor>({
      intentProcessorService,
      logger: { error: jest.fn() },
    })
    jobManager = new ExecuteSendBatchJobManager()
  })

  describe('createJob', () => {
    it('should create a job with correct data and options', () => {
      const jobData: ExecuteSendBatchJobData = {
        chainId: 1,
        proves: [
          { 
            hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex, 
            prover: '0x0000000000000000000000000000000000000001' as Hex, 
            source: 2 
          },
          { 
            hash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex, 
            prover: '0x0000000000000000000000000000000000000001' as Hex, 
            source: 2 
          },
        ],
      }

      const result = ExecuteSendBatchJobManager.createJob(jobData)

      // Verify job name
      expect(result.name).toBe(IntentProcessorJobName.EXECUTE_SEND_BATCH)

      // Verify job data is serialized
      expect(result.data).toEqual(serialize(jobData))

      // Verify job options
      expect(result.opts).toMatchObject({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      })

      // Verify job ID format
      expect(result.opts?.jobId).toBeDefined()
      expect(typeof result.opts?.jobId).toBe('string')
    })
  })

  describe('is', () => {
    it('should return true for ExecuteSendBatchJob', () => {
      const job = createMock<Job>({
        name: IntentProcessorJobName.EXECUTE_SEND_BATCH,
      })

      expect(jobManager.is(job as ExecuteSendBatchJob)).toBe(true)
    })

    it('should return false for other job types', () => {
      const job = createMock<Job>({
        name: 'OtherJobType',
      })

      expect(jobManager.is(job as ExecuteSendBatchJob)).toBe(false)
    })
  })

  describe('process', () => {
    it('should call intentProcessorService.executeSendBatch with deserialized data', async () => {
      const jobData: ExecuteSendBatchJobData = {
        chainId: 1,
        proves: [
          { hash: '0x1111' as Hex, prover: '0xProver1' as Hex, source: 2 },
        ],
      }

      const job = createMock<ExecuteSendBatchJob>({
        name: IntentProcessorJobName.EXECUTE_SEND_BATCH,
        data: serialize(jobData),
      })

      await jobManager.process(job, processor)

      expect(intentProcessorService.executeSendBatch).toHaveBeenCalledWith(jobData)
    })

    it('should not call intentProcessorService for other job types', async () => {
      const job = createMock<Job>({
        name: 'OtherJobType',
      })

      await jobManager.process(job as ExecuteSendBatchJob, processor)

      expect(intentProcessorService.executeSendBatch).not.toHaveBeenCalled()
    })
  })

  describe('onFailed', () => {
    it('should log error message', () => {
      const job = createMock<ExecuteSendBatchJob>()
      const error = new Error('Test error')

      jobManager.onFailed(job, processor, error)

      expect(processor.logger.error).toHaveBeenCalled()
      const call = (processor.logger.error as jest.Mock).mock.calls[0][0];
      expect(call).toHaveProperty('msg', `${ExecuteSendBatchJobManager.name}: Failed`);
      expect(call).toHaveProperty('error', 'Test error');
    })
  })
})
