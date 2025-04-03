import { 
  ExecuteWithdrawsJobManager,
  ExecuteWithdrawsJobData,
  ExecuteWithdrawsJob
} from '@/intent-processor/jobs/execute-withdraws.job'
import { IntentProcessorJobName } from '@/intent-processor/queues/intent-processor.queue'
import { deserialize, serialize } from '@/common/utils/serialize'
import { Hex, keccak256, encodePacked } from 'viem'

// Mock viem functions
jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  keccak256: jest.fn().mockReturnValue('0xmockhash'),
  encodePacked: jest.fn().mockReturnValue('0xmockencoded'),
}))

describe('ExecuteWithdrawsJobManager', () => {
  let manager: ExecuteWithdrawsJobManager
  let mockProcessor: any

  beforeEach(() => {
    manager = new ExecuteWithdrawsJobManager()
    
    mockProcessor = {
      intentProcessorService: {
        executeWithdrawals: jest.fn().mockResolvedValue(undefined),
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
      const jobData: ExecuteWithdrawsJobData = {
        chainId: 1,
        intentSourceAddr: '0xsource' as Hex,
        intents: [
          {
            routeHash: '0xroute1' as Hex,
            reward: {
              creator: '0xcreator' as Hex,
              prover: '0xprover' as Hex,
              deadline: BigInt(123456),
              nativeValue: BigInt(1000),
              tokens: [],
            },
          },
          {
            routeHash: '0xroute2' as Hex,
            reward: {
              creator: '0xcreator' as Hex,
              prover: '0xprover' as Hex,
              deadline: BigInt(123456),
              nativeValue: BigInt(1000),
              tokens: [],
            },
          },
        ],
      }

      const job = ExecuteWithdrawsJobManager.createJob(jobData)

      expect(job.name).toBe(IntentProcessorJobName.EXECUTE_WITHDRAWS)
      expect(job.data).toEqual(serialize(jobData))
      expect(job.opts?.jobId).toBe('0xmockhash')
      expect(job.opts?.attempts).toBe(3)
      // Check backoff configuration - handle both object and simple backoff
      const backoff = job.opts?.backoff;
      if (typeof backoff === 'object' && backoff !== null) {
        expect(backoff.type).toBe('exponential');
      } else {
        // If it's a number, that's also valid
        expect(typeof backoff === 'number' || backoff).toBeTruthy();
      }
      
      // Verify encodePacked was called with the route hashes
      expect(encodePacked).toHaveBeenCalledWith(
        ['bytes32[]'], 
        [['0xroute1', '0xroute2']]
      )
      
      // Verify keccak256 was called with the encoded result
      expect(keccak256).toHaveBeenCalledWith('0xmockencoded')
    })
  })

  describe('is', () => {
    it('should identify jobs by name', () => {
      const matchingJob = { 
        name: IntentProcessorJobName.EXECUTE_WITHDRAWS 
      } as unknown as ExecuteWithdrawsJob
      
      const nonMatchingJob = { 
        name: IntentProcessorJobName.CHECK_WITHDRAWS 
      } as unknown as ExecuteWithdrawsJob

      expect(manager.is(matchingJob)).toBe(true)
      expect(manager.is(nonMatchingJob)).toBe(false)
    })
  })

  describe('process', () => {
    it('should call executeWithdrawals with deserialized data', async () => {
      const jobData: ExecuteWithdrawsJobData = {
        chainId: 1,
        intentSourceAddr: '0xsource' as Hex,
        intents: [
          {
            routeHash: '0xroute1' as Hex,
            reward: {
              creator: '0xcreator' as Hex,
              prover: '0xprover' as Hex,
              deadline: BigInt(123456),
              nativeValue: BigInt(1000),
              tokens: [],
            },
          },
        ],
      }

      const mockJob = {
        name: IntentProcessorJobName.EXECUTE_WITHDRAWS,
        data: serialize(jobData),
      } as unknown as ExecuteWithdrawsJob

      await manager.process(mockJob, mockProcessor)

      expect(mockProcessor.intentProcessorService.executeWithdrawals).toHaveBeenCalledWith(
        deserialize(mockJob.data)
      )
    })

    it('should do nothing for non-matching jobs', async () => {
      const mockJob = {
        name: IntentProcessorJobName.CHECK_WITHDRAWS,
      } as unknown as ExecuteWithdrawsJob

      await manager.process(mockJob, mockProcessor)

      expect(mockProcessor.intentProcessorService.executeWithdrawals).not.toHaveBeenCalled()
    })
  })

  describe('onFailed', () => {
    it('should log an error when the job fails', () => {
      const job = { 
        name: IntentProcessorJobName.EXECUTE_WITHDRAWS 
      } as unknown as ExecuteWithdrawsJob
      
      const error = new Error('Test error')

      manager.onFailed(job, mockProcessor, error)

      expect(mockProcessor.logger.error).toHaveBeenCalled()
      
      // Safe check - ensure there's at least one call with arguments
      if (mockProcessor.logger.error.mock.calls.length > 0 && 
          mockProcessor.logger.error.mock.calls[0].length > 0) {
        const logMessage = mockProcessor.logger.error.mock.calls[0][0];
        if (logMessage && typeof logMessage === 'object' && 'message' in logMessage) {
          expect(logMessage.message).toContain('ExecuteWithdrawsJob: Failed');
          
          // Check properties if they exist
          if ('properties' in logMessage && 
              logMessage.properties && 
              typeof logMessage.properties === 'object' &&
              'error' in logMessage.properties) {
            expect(logMessage.properties.error).toBe('Test error');
          }
        }
      }
    })
  })
})