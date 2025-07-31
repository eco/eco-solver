import { FulfillIntentJob, FulfillIntentJobManager } from '../jobs/fulfill-intent.job'
import { IntentFulfillmentJobName } from '../queues/intent-fulfillment.queue'
import { deserialize, serialize } from '@/common/utils/serialize'
import { Hex } from 'viem'
import * as stringUtils from '@/common/utils/strings'
import { createMock } from '@golevelup/ts-jest'

describe('FulfillIntentJobManager', () => {
  describe('createJob', () => {
    it('should create a job with the correct parameters', () => {
      const jobData = {
        intentHash: '0x123' as Hex,
        chainId: 1,
      }

      const jobId = 'fulfill-0x123-1'
      jest.spyOn(stringUtils, 'getIntentJobId').mockReturnValue(jobId)

      const job = FulfillIntentJobManager.createJob(jobData)

      expect(stringUtils.getIntentJobId).toHaveBeenCalledWith(
        'fulfill',
        jobData.intentHash,
        jobData.chainId,
      )
      expect(job.name).toBe(IntentFulfillmentJobName.FULFILL_INTENT)
      expect(job.data).toEqual(serialize(jobData))
      expect(job.opts).toEqual({
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      })
    })
  })

  describe('process', () => {
    it('should call the fulfill intent service with the correct intent hash', async () => {
      const jobData = {
        intentHash: '0x456' as Hex,
        chainId: 1,
      }
      const job = {
        name: IntentFulfillmentJobName.FULFILL_INTENT,
        data: serialize(jobData),
      } as FulfillIntentJob

      const mockFulfillIntentService = {
        fulfill: jest.fn(),
      }
      const mockProcessor = {
        fulfillIntentService: mockFulfillIntentService,
        logger: {
          debug: jest.fn(),
          log: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
        },
      }

      const manager = new FulfillIntentJobManager()
      await manager.process(job, mockProcessor as any)

      expect(mockFulfillIntentService.fulfill).toHaveBeenCalledWith(jobData.intentHash)
    })
  })

  describe('onFailed', () => {
    it('should log an error message with job details', () => {
      const jobData = {
        intentHash: '0x789' as Hex,
        chainId: 1,
      }
      const job = {
        name: IntentFulfillmentJobName.FULFILL_INTENT,
        id: 'job-123',
        data: serialize(jobData),
      } as FulfillIntentJob
      const error = new Error('Something went wrong')
      const mockLogger = {
        error: jest.fn(),
      }
      const mockProcessor = {
        logger: mockLogger,
      }

      const manager = new FulfillIntentJobManager()
      manager.onFailed(job, mockProcessor as any, error)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'FulfillIntentJobManager: Failed',
          job: { id: 'job-123', data: jobData },
          error: 'Something went wrong',
        }),
      )
    })
  })
})
