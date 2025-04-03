import { createMock } from '@golevelup/ts-jest'
import { Job } from 'bullmq'
import { encodePacked, Hex, keccak256 } from 'viem'
import { serialize } from '@/common/utils/serialize'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { IntentProcessor } from '@/intent-processor/processors/intent.processor'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'
import {
  ExecuteWithdrawsJob,
  ExecuteWithdrawsJobData,
  ExecuteWithdrawsJobManager,
} from '@/intent-processor/jobs/execute-withdraws.job'

describe('ExecuteWithdrawsJobManager', () => {
  let jobManager: ExecuteWithdrawsJobManager
  let processor: IntentProcessor
  let intentProcessorService: IntentProcessorService

  beforeEach(() => {
    intentProcessorService = createMock<IntentProcessorService>()
    processor = createMock<IntentProcessor>({
      intentProcessorService,
      logger: { error: jest.fn() },
    })
    jobManager = new ExecuteWithdrawsJobManager()
  })

  describe('createJob', () => {
    it('should create a job with correct data and options', () => {
      const jobData: ExecuteWithdrawsJobData = {
        chainId: 1,
        intentSourceAddr: '0x0000000000000000000000000000000000000001' as Hex,
        intents: [
          { 
            routeHash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex, 
            reward: {
              creator: '0x0000000000000000000000000000000000000002' as Hex,
              prover: '0x0000000000000000000000000000000000000003' as Hex,
              deadline: 1000n,
              nativeValue: 100n,
              tokens: [],
            }
          },
          { 
            routeHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex, 
            reward: {
              creator: '0x0000000000000000000000000000000000000004' as Hex,
              prover: '0x0000000000000000000000000000000000000005' as Hex,
              deadline: 2000n,
              nativeValue: 200n,
              tokens: [],
            }
          },
        ],
      }

      const result = ExecuteWithdrawsJobManager.createJob(jobData)

      // Verify job name
      expect(result.name).toBe(IntentProcessorJobName.EXECUTE_WITHDRAWS)

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
    it('should return true for ExecuteWithdrawsJob', () => {
      const job = createMock<Job>({
        name: IntentProcessorJobName.EXECUTE_WITHDRAWS,
      })

      expect(jobManager.is(job as ExecuteWithdrawsJob)).toBe(true)
    })

    it('should return false for other job types', () => {
      const job = createMock<Job>({
        name: 'OtherJobType',
      })

      expect(jobManager.is(job as ExecuteWithdrawsJob)).toBe(false)
    })
  })

  describe('process', () => {
    it('should call intentProcessorService.executeWithdrawals with deserialized data', async () => {
      const jobData: ExecuteWithdrawsJobData = {
        chainId: 1,
        intentSourceAddr: '0xSource' as Hex,
        intents: [
          { 
            routeHash: '0x1111' as Hex, 
            reward: {
              creator: '0xCreator1' as Hex,
              prover: '0xProver1' as Hex,
              deadline: 1000n,
              nativeValue: 100n,
              tokens: [],
            }
          },
        ],
      }

      const job = createMock<ExecuteWithdrawsJob>({
        name: IntentProcessorJobName.EXECUTE_WITHDRAWS,
        data: serialize(jobData),
      })

      await jobManager.process(job, processor)

      expect(intentProcessorService.executeWithdrawals).toHaveBeenCalledWith(jobData)
    })

    it('should not call intentProcessorService for other job types', async () => {
      const job = createMock<Job>({
        name: 'OtherJobType',
      })

      await jobManager.process(job as ExecuteWithdrawsJob, processor)

      expect(intentProcessorService.executeWithdrawals).not.toHaveBeenCalled()
    })
  })

  describe('onFailed', () => {
    it('should log error message', () => {
      const job = createMock<ExecuteWithdrawsJob>()
      const error = new Error('Test error')

      jobManager.onFailed(job, processor, error)

      expect(processor.logger.error).toHaveBeenCalled()
      const call = (processor.logger.error as jest.Mock).mock.calls[0][0];
      expect(call).toHaveProperty('msg', 'ExecuteWithdrawsJob: Failed');
      expect(call).toHaveProperty('error', 'Test error');
    })
  })
})
