import { 
  ExecuteSendBatchJobManager,
  ExecuteSendBatchJobData,
  ExecuteSendBatchJob
} from '@/intent-processor/jobs/execute-send-batch.job'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { serialize } from '@/common/utils/serialize'
import { Hex, keccak256, encodePacked } from 'viem'

// Mock viem functions
jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  keccak256: jest.fn().mockReturnValue('0xmockhash'),
  encodePacked: jest.fn().mockReturnValue('0xmockencoded'),
}))

describe('ExecuteSendBatchJobManager', () => {
  let manager: ExecuteSendBatchJobManager
  let mockProcessor: any

  beforeEach(() => {
    manager = new ExecuteSendBatchJobManager()
    
    mockProcessor = {
      intentProcessorService: {
        executeSendBatch: jest.fn().mockResolvedValue(undefined),
      },
      logger: {
        log: jest.fn(),
        error: jest.fn(),
      },
    }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('createJob', () => {
    it('should create a job with the correct parameters', () => {
      const jobData: ExecuteSendBatchJobData = {
        chainId: 10,
        proves: [
          {
            hash: '0xhash1' as Hex,
            prover: '0xprover1' as Hex,
            source: 1,
          },
          {
            hash: '0xhash2' as Hex,
            prover: '0xprover1' as Hex,
            source: 1,
          },
        ],
      }

      const job = ExecuteSendBatchJobManager.createJob(jobData)

      expect(job.name).toBe(IntentProcessorJobName.EXECUTE_SEND_BATCH)
      expect(job.data).toEqual(serialize(jobData))
      expect(job.opts?.jobId).toBe('0xmockhash')
      expect(job.opts?.attempts).toBe(3)
      expect(job.opts?.backoff).toEqual({
        type: 'exponential',
        delay: 1000,
      })
      
      // Verify keccak256 was called with the encoded result
      expect(keccak256).toHaveBeenCalledWith('0xmockencoded')
    })
  })

  describe('is', () => {
    it('should identify jobs by name', () => {
      const matchingJob = { 
        name: IntentProcessorJobName.EXECUTE_SEND_BATCH 
      } as unknown as ExecuteSendBatchJob
      
      const nonMatchingJob = { 
        name: IntentProcessorJobName.CHECK_SEND_BATCH 
      } as unknown as ExecuteSendBatchJob

      expect(manager.is(matchingJob)).toBe(true)
      expect(manager.is(nonMatchingJob)).toBe(false)
    })
  })

  describe('process', () => {
    it('should call executeSendBatch with deserialized data', async () => {
      const jobData: ExecuteSendBatchJobData = {
        chainId: 10,
        proves: [
          {
            hash: '0xhash1' as Hex,
            prover: '0xprover1' as Hex,
            source: 1,
          },
        ],
      }

      const serializedData = serialize(jobData)

      const mockJob = {
        name: IntentProcessorJobName.EXECUTE_SEND_BATCH,
        data: serializedData,
      } as unknown as ExecuteSendBatchJob

      await manager.process(mockJob, mockProcessor)

      expect(mockProcessor.intentProcessorService.executeSendBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 10,
          proves: expect.arrayContaining([
            expect.objectContaining({
              hash: '0xhash1',
              prover: '0xprover1',
              source: 1,
            }),
          ]),
        })
      )
    })

    it('should do nothing for non-matching jobs', async () => {
      const mockJob = {
        name: IntentProcessorJobName.CHECK_SEND_BATCH,
      } as unknown as ExecuteSendBatchJob

      await manager.process(mockJob, mockProcessor)

      expect(mockProcessor.intentProcessorService.executeSendBatch).not.toHaveBeenCalled()
    })
  })

  describe('onFailed', () => {
    it('should log an error when the job fails', () => {
      const job = { 
        name: IntentProcessorJobName.EXECUTE_SEND_BATCH 
      } as unknown as ExecuteSendBatchJob
      
      const error = new Error('Test error')

      manager.onFailed(job, mockProcessor, error)

      expect(mockProcessor.logger.error).toHaveBeenCalled()
    })
  })
})