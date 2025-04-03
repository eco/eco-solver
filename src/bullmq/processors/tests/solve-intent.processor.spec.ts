import { Test, TestingModule } from '@nestjs/testing'
import { SolveIntentProcessor } from '../solve-intent.processor'
import { CreateIntentService } from '@/intent/create-intent.service'
import { ValidateIntentService } from '@/intent/validate-intent.service'
import { FeasableIntentService } from '@/intent/feasable-intent.service'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'
import { createMock } from '@golevelup/ts-jest'
import { QUEUES } from '@/common/redis/constants'
import { Job } from 'bullmq'
import { Logger } from '@nestjs/common'
import { Hex } from 'viem'

describe('SolveIntentProcessor', () => {
  let processor: SolveIntentProcessor
  let createIntentService: CreateIntentService
  let validateIntentService: ValidateIntentService
  let feasableIntentService: FeasableIntentService
  let fulfillIntentService: FulfillIntentService

  beforeEach(async () => {
    // Mock Logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {})

    // Create the testing module with mocked services
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolveIntentProcessor,
        {
          provide: CreateIntentService,
          useValue: createMock<CreateIntentService>({
            createIntent: jest.fn().mockResolvedValue(true),
          }),
        },
        {
          provide: ValidateIntentService,
          useValue: createMock<ValidateIntentService>({
            validateIntent: jest.fn().mockResolvedValue(true),
          }),
        },
        {
          provide: FeasableIntentService,
          useValue: createMock<FeasableIntentService>({
            feasableIntent: jest.fn().mockResolvedValue(true),
          }),
        },
        {
          provide: FulfillIntentService,
          useValue: createMock<FulfillIntentService>({
            executeFulfillIntent: jest.fn().mockResolvedValue(true),
          }),
        },
      ],
    }).compile()

    processor = module.get<SolveIntentProcessor>(SolveIntentProcessor)
    createIntentService = module.get<CreateIntentService>(CreateIntentService)
    validateIntentService = module.get<ValidateIntentService>(ValidateIntentService)
    feasableIntentService = module.get<FeasableIntentService>(FeasableIntentService)
    fulfillIntentService = module.get<FulfillIntentService>(FulfillIntentService)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('process method', () => {
    it('should call createIntentService for create_intent job', async () => {
      // Create mock job
      const jobData = {
        args: {
          _intent: '0x1234' as Hex,
          _creator: '0xabcd' as Hex,
        },
        address: '0xcontract' as Hex,
        blockHash: '0xblockhash' as Hex,
        blockNumber: BigInt(123),
        data: '0xdata' as Hex,
        logIndex: 0,
        transactionHash: '0xtxhash' as Hex,
        transactionIndex: 0,
        removed: false,
        eventName: 'IntentCreated',
        topics: [],
      }

      const mockJob = {
        name: QUEUES.SOURCE_INTENT.jobs.create_intent,
        data: jobData,
      } as Job

      // Setup spy for the service method
      const createIntentSpy = jest.spyOn(createIntentService, 'createIntent')

      // Call the processor
      await processor.process(mockJob)

      // Verify the service was called with the job data
      expect(createIntentSpy).toHaveBeenCalledTimes(1)
      expect(createIntentSpy).toHaveBeenCalledWith(jobData)
    })

    it('should call validateIntentService for validate_intent job', async () => {
      // Create mock job with intent hash
      const intentHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex
      const mockJob = {
        name: QUEUES.SOURCE_INTENT.jobs.validate_intent,
        data: intentHash,
      } as Job

      // Setup spy for the service method
      const validateIntentSpy = jest.spyOn(validateIntentService, 'validateIntent')

      // Call the processor
      await processor.process(mockJob)

      // Verify the service was called with the intent hash
      expect(validateIntentSpy).toHaveBeenCalledTimes(1)
      expect(validateIntentSpy).toHaveBeenCalledWith(intentHash)
    })

    it('should call validateIntentService for retry_intent job', async () => {
      // Create mock job with intent hash
      const intentHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex
      const mockJob = {
        name: QUEUES.SOURCE_INTENT.jobs.retry_intent,
        data: intentHash,
      } as Job

      // Setup spy for the service method
      const validateIntentSpy = jest.spyOn(validateIntentService, 'validateIntent')

      // Call the processor
      await processor.process(mockJob)

      // Verify the service was called with the intent hash
      expect(validateIntentSpy).toHaveBeenCalledTimes(1)
      expect(validateIntentSpy).toHaveBeenCalledWith(intentHash)
    })

    it('should call feasableIntentService for feasable_intent job', async () => {
      // Create mock job with intent hash
      const intentHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex
      const mockJob = {
        name: QUEUES.SOURCE_INTENT.jobs.feasable_intent,
        data: intentHash,
      } as Job

      // Setup spy for the service method
      const feasableIntentSpy = jest.spyOn(feasableIntentService, 'feasableIntent')

      // Call the processor
      await processor.process(mockJob)

      // Verify the service was called with the intent hash
      expect(feasableIntentSpy).toHaveBeenCalledTimes(1)
      expect(feasableIntentSpy).toHaveBeenCalledWith(intentHash)
    })

    it('should call fulfillIntentService for fulfill_intent job', async () => {
      // Create mock job with intent hash
      const intentHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex
      const mockJob = {
        name: QUEUES.SOURCE_INTENT.jobs.fulfill_intent,
        data: intentHash,
      } as Job

      // Setup spy for the service method
      const fulfillIntentSpy = jest.spyOn(fulfillIntentService, 'executeFulfillIntent')

      // Call the processor
      await processor.process(mockJob)

      // Verify the service was called with the intent hash
      expect(fulfillIntentSpy).toHaveBeenCalledTimes(1)
      expect(fulfillIntentSpy).toHaveBeenCalledWith(intentHash)
    })

    it('should reject with an error for unknown job types', async () => {
      // Create mock job with unknown job name
      const mockJob = {
        name: 'unknown_job_type',
        data: {},
      } as Job

      // Call the processor and expect it to reject
      await expect(processor.process(mockJob)).rejects.toEqual('Invalid job type')

      // Verify that no service methods were called
      expect(createIntentService.createIntent).not.toHaveBeenCalled()
      expect(validateIntentService.validateIntent).not.toHaveBeenCalled()
      expect(feasableIntentService.feasableIntent).not.toHaveBeenCalled()
      expect(fulfillIntentService.executeFulfillIntent).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle errors in onJobFailed', () => {
      const loggerSpy = jest.spyOn(processor['logger'], 'error')
      
      // Create mock job and error
      const mockJob = {
        name: QUEUES.SOURCE_INTENT.jobs.create_intent,
        data: {},
      } as Job
      
      const mockError = new Error('Test error message')
      
      // Call the onJobFailed handler
      processor.onJobFailed(mockJob, mockError)
      
      // Verify that the error was logged
      expect(loggerSpy).toHaveBeenCalledTimes(1)
      // The error log structure may vary, just check that it was called
      expect(loggerSpy).toHaveBeenCalled()
    })
    
    it('should properly propagate service errors', async () => {
      // Create mock job
      const intentHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex
      const mockJob = {
        name: QUEUES.SOURCE_INTENT.jobs.validate_intent,
        data: intentHash,
      } as Job
      
      // Make the service throw an error
      const testError = new Error('Service validation error')
      jest.spyOn(validateIntentService, 'validateIntent')
        .mockRejectedValue(testError)
        
      // Call the processor and expect it to reject with the service error
      await expect(processor.process(mockJob)).rejects.toEqual(testError)
    })
  })
})
