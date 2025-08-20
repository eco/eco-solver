import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { getModelToken } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Hex } from "viem"

import { FeasableIntentService } from '@eco-solver/intent/feasable-intent.service'
import { IntentSourceModel } from '@eco-solver/intent/schemas/intent-source.schema'
import { FeeService } from '@eco-solver/fee/fee.service'
import { UtilsIntentService } from '@eco-solver/intent/utils-intent.service'
import { EcoConfigService } from '@libs/eco-solver-config'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { IntentFulfillmentQueue } from '@eco-solver/intent-fulfillment/queues/intent-fulfillment.queue'
import { QuoteError } from '@eco-solver/quote/errors'

// Minimal re-mock of queue wrapper
const mockQueue = () => createMock<IntentFulfillmentQueue>({ addFulfillIntentJob: jest.fn() })

describe('FeasableIntentService', () => {
  let service: FeasableIntentService
  let feeService: DeepMocked<FeeService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let fulfillmentQueue: DeepMocked<IntentFulfillmentQueue>

  const intentHash = '0x123' as Hex

  beforeEach(async () => {
    fulfillmentQueue = mockQueue()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeasableIntentService,
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
        { provide: getModelToken(IntentSourceModel.name), useValue: createMock<Model<any>>() },
        { provide: IntentFulfillmentQueue, useValue: fulfillmentQueue },
      ],
    }).compile()

    service = module.get(FeasableIntentService)
    feeService = module.get(FeeService)
    utilsIntentService = module.get(UtilsIntentService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('queues intent when feasible', async () => {
    const mockModel: any = {
      intent: { logIndex: 1, route: { destination: 2n }, hash: intentHash },
    }
    jest
      .spyOn(utilsIntentService, 'getIntentProcessData')
      .mockResolvedValue({ model: mockModel, solver: {} } as any)
    jest.spyOn(feeService, 'isRouteFeasible').mockResolvedValue({} as any)

    await service.feasableIntent(intentHash)

    expect(fulfillmentQueue.addFulfillIntentJob).toHaveBeenCalledWith({
      intentHash,
      chainId: 2,
    })
  })

  it('updates model when infeasible', async () => {
    const mockModel: any = { intent: { route: { destination: 1n }, logIndex: 1 } }
    jest
      .spyOn(utilsIntentService, 'getIntentProcessData')
      .mockResolvedValue({ model: mockModel, solver: {} } as any)
    jest
      .spyOn(feeService, 'isRouteFeasible')
      .mockResolvedValue({ error: QuoteError.MultiFulfillRoute() } as any)

    await service.feasableIntent(intentHash)
    expect(fulfillmentQueue.addFulfillIntentJob).not.toHaveBeenCalled()
  })

  it('ignores when model/solver missing and propagates error', async () => {
    jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(undefined as any)
    await service.feasableIntent(intentHash)
    expect(fulfillmentQueue.addFulfillIntentJob).not.toHaveBeenCalled()

    const e = new Error('db')
    jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue({ err: e } as any)
    await expect(service.feasableIntent(intentHash)).rejects.toThrow(e)
  })
})
