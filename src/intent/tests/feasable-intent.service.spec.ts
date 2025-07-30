import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { Model } from 'mongoose'
import { UtilsIntentService } from '../utils-intent.service'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Queue } from 'bullmq'
import { FeasableIntentService } from '../feasable-intent.service'
import { Hex } from 'viem'
import { FeeService } from '@/fee/fee.service'
import { QuoteError } from '@/quote/errors'
import { EcoAnalyticsService } from '@/analytics'
import { NegativeIntentAnalyzerService } from '@/negative-intents/services/negative-intents-analyzer.service'

describe('FeasableIntentService', () => {
  let feasableIntentService: FeasableIntentService
  let feeService: DeepMocked<FeeService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let negativeIntentAnalyzerService: NegativeIntentAnalyzerService
  let queue: DeepMocked<Queue>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()
  const address1 = '0x1111111111111111111111111111111111111111'
  const address2 = '0x2222222222222222222222222222222222222222'
  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        FeasableIntentService,
        {
          provide: NegativeIntentAnalyzerService,
          useValue: createMock<NegativeIntentAnalyzerService>(),
        },
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
        {
          provide: getModelToken(IntentSourceModel.name),
          useValue: createMock<Model<IntentSourceModel>>(),
        },
      ],
      imports: [
        BullModule.registerQueue({
          name: QUEUES.SOURCE_INTENT.queue,
        }),
      ],
    })
      .overrideProvider(getQueueToken(QUEUES.SOURCE_INTENT.queue))
      .useValue(createMock<Queue>())
      .compile()

    feasableIntentService = chainMod.get(FeasableIntentService)
    await feasableIntentService.onModuleInit()
    feeService = chainMod.get(FeeService)
    utilsIntentService = chainMod.get(UtilsIntentService)
    ecoConfigService = chainMod.get(EcoConfigService)
    queue = chainMod.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))

    feasableIntentService['logger'].debug = mockLogDebug
    feasableIntentService['logger'].log = mockLogLog
    feasableIntentService['logger'].error = mockLogError
    negativeIntentAnalyzerService = chainMod.get(NegativeIntentAnalyzerService)
    jest.spyOn(negativeIntentAnalyzerService, 'isNegativeIntentHash').mockResolvedValue(false)
  })

  const mockData = { model: { intent: { logIndex: 1, hash: '0x123' as Hex } }, solver: {} }
  const intentHash = mockData.model.intent.hash
  const jobId = `feasable-${intentHash}-${mockData.model.intent.logIndex}`
  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
  })

  describe('onModuleInit', () => {
    it('should set the intentJobConfig', async () => {
      const mockConfig = { foo: 'bar' }
      jest
        .spyOn(ecoConfigService, 'getRedis')
        .mockReturnValue({ jobs: { intentJobConfig: mockConfig } } as any)
      await feasableIntentService.onModuleInit()
      expect(feasableIntentService['intentJobConfig']).toEqual(mockConfig)
    })
  })

  describe('on feasableIntent', () => {
    it('should error out if processing intent data fails', async () => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(undefined)
      await expect(feasableIntentService.feasableIntent({ intentHash })).resolves.not.toThrow()

      const error = new Error('noo')
      jest
        .spyOn(utilsIntentService, 'getIntentProcessData')
        .mockResolvedValue({ err: error } as any)
      await expect(feasableIntentService.feasableIntent({ intentHash })).rejects.toThrow(error)
    })

    it('should fail if intent has more than 1 target call', async () => {
      const mockModel = {
        intent: {
          route: {
            calls: [
              { data: '0x', target: address1 },
              { data: '0x', target: address2 },
            ],
          },
          logIndex: 1,
        },
      }
      const errData = { solver: mockData.solver, model: mockModel } as any
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(errData)
      jest.spyOn(feeService, 'isRouteFeasible').mockResolvedValue({
        error: QuoteError.MultiFulfillRoute(),
      } as any)
      await feasableIntentService.feasableIntent({ intentHash })
      expect(utilsIntentService.updateInfeasableIntentModel).toHaveBeenCalledWith(
        errData.model,
        QuoteError.MultiFulfillRoute(),
      )
      expect(mockLogDebug).toHaveBeenCalledTimes(2)
      expect(mockLogDebug).toHaveBeenNthCalledWith(2, {
        msg: `FeasableIntent intent ${intentHash}`,
        feasable: false,
      })
      expect(queue.add).not.toHaveBeenCalled()
    })

    it('should update the db intent model if the intent is not feasable', async () => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(mockData as any)
      jest
        .spyOn(feeService, 'isRouteFeasible')
        .mockResolvedValue({ error: QuoteError.MultiFulfillRoute() })

      await feasableIntentService.feasableIntent({ intentHash })

      expect(utilsIntentService.updateInfeasableIntentModel).toHaveBeenCalledWith(
        mockData.model,
        QuoteError.MultiFulfillRoute(),
      )
    })

    it('should add the intent when its feasable to the queue to be processed', async () => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(mockData as any)
      jest.spyOn(feeService, 'isRouteFeasible').mockResolvedValue({ calls: [] } as any)

      await feasableIntentService.feasableIntent({ intentHash })

      expect(mockLogDebug).toHaveBeenCalledTimes(2)
      expect(mockLogDebug).toHaveBeenNthCalledWith(2, {
        msg: `FeasableIntent intent ${intentHash}`,
        feasable: true,
        jobId,
      })
      expect(queue.add).toHaveBeenCalledWith(
        QUEUES.SOURCE_INTENT.jobs.fulfill_intent,
        { intentHash },
        {
          jobId,
          ...feasableIntentService['intentJobConfig'],
        },
      )
    })
  })
})
