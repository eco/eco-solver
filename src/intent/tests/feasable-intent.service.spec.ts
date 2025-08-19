import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoAnalyticsService } from '@/analytics'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { FeasableIntentService } from '../feasable-intent.service'
import { FeeService } from '@/fee/fee.service'
import { getModelToken } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { IntentFulfillmentQueue } from '@/intent-fulfillment/queues/intent-fulfillment.queue'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { Model } from 'mongoose'
import { NegativeIntentAnalyzerService } from '@/negative-intents/services/negative-intents-analyzer.service'
import { QuoteError } from '@/quote/errors'
import { Test, TestingModule } from '@nestjs/testing'
import { UtilsIntentService } from '../utils-intent.service'

// Minimal re-mock of queue wrapper
const mockQueue = () => createMock<IntentFulfillmentQueue>({ addFulfillIntentJob: jest.fn() })

describe('FeasableIntentService', () => {
  let service: FeasableIntentService
  let feeService: DeepMocked<FeeService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let negativeIntentAnalyzerService: NegativeIntentAnalyzerService
  let fulfillmentQueue: DeepMocked<IntentFulfillmentQueue>

  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()
  const address1 = '0x1111111111111111111111111111111111111111'
  const address2 = '0x2222222222222222222222222222222222222222'

  beforeEach(async () => {
    fulfillmentQueue = mockQueue()

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
        { provide: IntentFulfillmentQueue, useValue: fulfillmentQueue },
      ],
      imports: [],
    }).compile()

    service = chainMod.get(FeasableIntentService)
    await service.onModuleInit()
    feeService = chainMod.get(FeeService)
    utilsIntentService = chainMod.get(UtilsIntentService)
    ecoConfigService = chainMod.get(EcoConfigService)

    service['logger'].debug = mockLogDebug
    service['logger'].log = mockLogLog
    service['logger'].error = mockLogError
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

  describe('on feasableIntent', () => {
    it('should error out if processing intent data fails', async () => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(undefined)
      await expect(service.feasableIntent({ intentHash })).resolves.not.toThrow()

      const error = new Error('noo')
      jest
        .spyOn(utilsIntentService, 'getIntentProcessData')
        .mockResolvedValue({ err: error } as any)
      await expect(service.feasableIntent({ intentHash })).rejects.toThrow(error)
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
      await service.feasableIntent({ intentHash })
      expect(utilsIntentService.updateInfeasableIntentModel).toHaveBeenCalledWith(
        errData.model,
        QuoteError.MultiFulfillRoute(),
      )
      expect(mockLogDebug).toHaveBeenCalledTimes(2)
      expect(mockLogDebug).toHaveBeenNthCalledWith(2, {
        msg: `FeasableIntent intent ${intentHash}`,
        feasable: false,
      })
      expect(fulfillmentQueue.addFulfillIntentJob).not.toHaveBeenCalled()
    })

    it('should update the db intent model if the intent is not feasable', async () => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(mockData as any)
      jest
        .spyOn(feeService, 'isRouteFeasible')
        .mockResolvedValue({ error: QuoteError.MultiFulfillRoute() })

      await service.feasableIntent({ intentHash })

      expect(utilsIntentService.updateInfeasableIntentModel).toHaveBeenCalledWith(
        mockData.model,
        QuoteError.MultiFulfillRoute(),
      )
    })

    it('queues intent when feasible', async () => {
      const mockModel: any = {
        intent: { logIndex: 1, route: { destination: 2n }, hash: intentHash },
      }
      jest
        .spyOn(utilsIntentService, 'getIntentProcessData')
        .mockResolvedValue({ model: mockModel, solver: {} } as any)
      jest.spyOn(feeService, 'isRouteFeasible').mockResolvedValue({} as any)

      await service.feasableIntent({ intentHash })

      expect(fulfillmentQueue.addFulfillIntentJob).toHaveBeenCalledWith({
        intentHash,
        chainId: 2,
      })
    })
  })
})
