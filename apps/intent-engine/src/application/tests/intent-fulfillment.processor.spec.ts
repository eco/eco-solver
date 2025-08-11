  IntentFulfillmentQueue,
  IntentFulfillmentJobName,
} from '@app/intent-engine/queues/intent-fulfillment.queue'

describe('IntentFulfillmentProcessor', () => {
  let processor: IntentFulfillmentProcessor
  let fulfillIntentService: DeepMocked<FulfillIntentService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
      ],
    }).compile()

    processor = module.get<IntentFulfillmentProcessor>(IntentFulfillmentProcessor)
    fulfillIntentService = module.get(FulfillIntentService)
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
})
