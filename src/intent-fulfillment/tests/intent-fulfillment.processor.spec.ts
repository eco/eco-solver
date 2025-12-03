import { Test, TestingModule } from '@nestjs/testing'
import { IntentFulfillmentProcessor } from '../processors/intent-fulfillment.processor'
import { getQueueToken } from '@nestjs/bullmq'
import {
  IntentFulfillmentQueue,
  IntentFulfillmentJobName,
} from '../queues/intent-fulfillment.queue'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { FulfillIntentJob } from '../jobs/fulfill-intent.job'
import { serialize } from '@/common/utils/serialize'
import { Hex } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'

describe('IntentFulfillmentProcessor', () => {
  let processor: IntentFulfillmentProcessor
  let fulfillIntentService: DeepMocked<FulfillIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let module: TestingModule

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        IntentFulfillmentProcessor,
        {
          provide: getQueueToken(IntentFulfillmentQueue.queueName),
          useValue: createMock<IntentFulfillmentQueue>(),
        },
        {
          provide: FulfillIntentService,
          useValue: createMock<FulfillIntentService>(),
        },
        {
          provide: EcoConfigService,
          useValue: createMock<EcoConfigService>({
            getFulfill: jest.fn().mockReturnValue({
              enabled: true,
              run: 'single',
            }),
          }),
        },
      ],
    }).compile()

    processor = module.get<IntentFulfillmentProcessor>(IntentFulfillmentProcessor)
    fulfillIntentService = module.get(FulfillIntentService)
    ecoConfigService = module.get(EcoConfigService)
  })

  it('should be defined', () => {
    expect(processor).toBeDefined()
  })

  it('should delegate job processing to FulfillIntentService with correct params', async () => {
    const intentHash = '0x12345' as Hex
    const jobData = { intentHash, chainId: 1 }
    const mockJob = {
      name: IntentFulfillmentJobName.FULFILL_INTENT,
      data: serialize(jobData),
    } as FulfillIntentJob

    // Directly test the job manager's process method, which is what the processor calls
    const manager = processor['jobManagers'][0]
    await manager.process(mockJob, processor)

    expect(fulfillIntentService.fulfill).toHaveBeenCalledTimes(1)
    expect(fulfillIntentService.fulfill).toHaveBeenCalledWith(intentHash)
  })

  it('should not process a job with an unknown name', async () => {
    const mockJob = {
      name: 'UNKNOWN_JOB',
      data: serialize({}),
    } as any

    const manager = processor['jobManagers'][0]
    await manager.process(mockJob, processor)

    expect(fulfillIntentService.fulfill).not.toHaveBeenCalled()
  })

  describe('process with enabled flag', () => {
    const mockJob = {
      id: 'job-123',
      name: IntentFulfillmentJobName.FULFILL_INTENT,
      data: {
        intentHash: '0x123456789abcdef' as Hex,
        chainId: 1,
      },
    }

    describe('when fulfillments are enabled', () => {
      beforeEach(() => {
        jest.spyOn(ecoConfigService, 'getFulfill').mockReturnValue({
          enabled: true,
          run: 'single',
        })
        // Recreate processor with enabled config
        processor = new IntentFulfillmentProcessor(
          module.get(getQueueToken(IntentFulfillmentQueue.queueName)),
          fulfillIntentService,
          ecoConfigService,
        )
      })

      it('should process jobs normally', async () => {
        // Just verify it doesn't throw and doesn't return skipped
        const result = await processor.process(mockJob as any)

        expect(result).not.toEqual({ skipped: true, reason: 'fulfillments_disabled' })
      })
    })

    describe('when fulfillments are disabled', () => {
      let mockLogLog: jest.SpyInstance

      beforeEach(() => {
        jest.spyOn(ecoConfigService, 'getFulfill').mockReturnValue({
          enabled: false,
          run: 'single',
        })
        // Recreate processor with disabled config
        processor = new IntentFulfillmentProcessor(
          module.get(getQueueToken(IntentFulfillmentQueue.queueName)),
          fulfillIntentService,
          ecoConfigService,
        )
        mockLogLog = jest.spyOn(processor['logger'], 'log')
      })

      it('should skip job processing', async () => {
        const result = await processor.process(mockJob as any)

        expect(result).toEqual({ skipped: true, reason: 'fulfillments_disabled' })
      })

      it('should log that job was skipped', async () => {
        await processor.process(mockJob as any)

        expect(mockLogLog).toHaveBeenCalledWith(
          expect.objectContaining({
            msg: expect.stringContaining('Fulfillment job skipped'),
            jobId: 'job-123',
            intentHash: '0x123456789abcdef',
          }),
        )
      })
    })

    describe('when enabled is undefined (default)', () => {
      beforeEach(() => {
        jest.spyOn(ecoConfigService, 'getFulfill').mockReturnValue({
          run: 'single',
        })
        // Recreate processor with default config
        processor = new IntentFulfillmentProcessor(
          module.get(getQueueToken(IntentFulfillmentQueue.queueName)),
          fulfillIntentService,
          ecoConfigService,
        )
      })

      it('should process jobs normally (default enabled)', async () => {
        // Just verify it doesn't throw and doesn't return skipped
        const result = await processor.process(mockJob as any)

        expect(result).not.toEqual({ skipped: true, reason: 'fulfillments_disabled' })
      })
    })
  })
})
