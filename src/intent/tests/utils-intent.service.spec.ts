const mockDecodeFunctionData = jest.fn()
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { Model } from 'mongoose'
import { UtilsIntentService } from '../utils-intent.service'
import { getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Queue } from 'bullmq'
import { EcoError } from '../../common/errors/eco-error'
import { getFunctionBytes } from '../../common/viem/contracts'
import { FulfillmentLog } from '@/contracts/inbox'
import { CallDataInterface } from '@/contracts'
import { ValidationChecks } from '@/intent/validation.sevice'
import { QuoteError } from '@/quote/errors'
import { EcoAnalyticsService } from '@/analytics'

jest.mock('viem', () => {
  return {
    ...jest.requireActual('viem'),
    decodeFunctionData: mockDecodeFunctionData,
  }
})

describe('UtilsIntentService', () => {
  let utilsIntentService: UtilsIntentService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let intentModel: DeepMocked<Model<IntentSourceModel>>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogWarn = jest.fn()
  const address1 = '0x1111111111111111111111111111111111111111'
  const address2 = '0x2222222222222222222222222222222222222222'
  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        UtilsIntentService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: getModelToken(IntentSourceModel.name),
          useValue: createMock<Model<IntentSourceModel>>(),
        },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
      ],
    })
      .overrideProvider(getQueueToken(QUEUES.SOURCE_INTENT.queue))
      .useValue(createMock<Queue>())
      .compile()

    utilsIntentService = chainMod.get(UtilsIntentService)
    ecoConfigService = chainMod.get(EcoConfigService)
    intentModel = chainMod.get(getModelToken(IntentSourceModel.name))

    utilsIntentService['logger'].debug = mockLogDebug
    utilsIntentService['logger'].log = mockLogLog
    utilsIntentService['logger'].warn = mockLogWarn
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
    mockLogWarn.mockClear()
    mockDecodeFunctionData.mockClear()
  })

  describe('on update models', () => {
    const mockUpdateOne = jest.fn()
    const model = { intent: { hash: '0x123' } } as any
    beforeEach(() => {
      intentModel.updateOne = mockUpdateOne
    })

    afterEach(() => {
      mockUpdateOne.mockClear()
    })

    describe('on updateIntentModel', () => {
      it('should updateOne model off the intent hash', async () => {
        await utilsIntentService.updateIntentModel(model)
        expect(mockUpdateOne).toHaveBeenCalledTimes(1)
        expect(mockUpdateOne).toHaveBeenCalledWith({ 'intent.hash': model.intent.hash }, model)
      })
    })

    describe('on updateInvalidIntentModel', () => {
      it('should updateOne the model as invalid', async () => {
        const invalidCause = {
          supportedProver: false,
          supportedNative: true,
          supportedTargets: true,
          supportedTransaction: true,
          validTransferLimit: true,
          validExpirationTime: true,
          validDestination: true,
          fulfillOnDifferentChain: true,
          sufficientBalance: true,
        } as ValidationChecks
        await utilsIntentService.updateInvalidIntentModel(model, invalidCause)
        expect(mockUpdateOne).toHaveBeenCalledTimes(1)
        expect(mockUpdateOne).toHaveBeenCalledWith(
          { 'intent.hash': model.intent.hash },
          { ...model, status: 'INVALID', receipt: invalidCause },
        )
      })
    })

    describe('on updateInfeasableIntentModel', () => {
      it('should updateOne the model as infeasable', async () => {
        const error = QuoteError.RouteIsInfeasable(
          { token: 11n, native: 22n },
          { token: 1n, native: 2n },
        )
        await utilsIntentService.updateInfeasableIntentModel(model, error)
        expect(mockUpdateOne).toHaveBeenCalledTimes(1)
        expect(mockUpdateOne).toHaveBeenCalledWith(
          { 'intent.hash': model.intent.hash },
          { ...model, status: 'INFEASABLE', receipt: error },
        )
      })
    })
  })

  describe('on getIntentProcessData', () => {
    const intentHash = address1
    const model = {
      intent: { route: { hash: intentHash, source: 'opt-sepolia', destination: '85432' } },
      event: { sourceNetwork: 'opt-sepolia' },
    } as any
    it('should return undefined if it could not find the model in the db', async () => {
      intentModel.findOne = jest.fn().mockReturnValue(null)
      expect(await utilsIntentService.getIntentProcessData(intentHash)).toStrictEqual({
        err: EcoError.IntentSourceDataNotFound(intentHash),
        model: null,
        solver: null,
      })
    })

    it('should return undefined if solver could for destination chain could not be found', async () => {
      intentModel.findOne = jest.fn().mockReturnValue(model)
      ecoConfigService.getSolver = jest.fn().mockReturnValue(undefined)
      const result = await utilsIntentService.getIntentProcessData(intentHash)
      expect(result).toBe(undefined)
      // Business event logging now handled by specialized logger methods
    })

    it('should throw an error if model db throws (permissions issue usually)', async () => {
      const err = new Error('DB error')
      intentModel.findOne = jest.fn().mockRejectedValue(err)
      const result = await utilsIntentService.getIntentProcessData(intentHash)
      expect(result).toBe(undefined)
      // Error logging handled by business event methods
    })

    it('should return the model and solver when successful', async () => {
      intentModel.findOne = jest.fn().mockReturnValue(model)
      const solver = { chainID: '85432' }
      ecoConfigService.getSolver = jest.fn().mockReturnValue(solver)
      expect(await utilsIntentService.getIntentProcessData(intentHash)).toEqual({ model, solver })
    })
  })

  describe('on updateOnFulfillment', () => {
    const fulfillment = {
      args: {
        _hash: '0x123',
        _solver: '0x456',
        _intent: '0x789',
        _receipt: '0xabc',
        _result: '0xdef',
      },
    } as any as FulfillmentLog
    it('should handle fulfillment when no intent exists in the db', async () => {
      intentModel.findOne = jest.fn().mockReturnValue(undefined)
      await utilsIntentService.updateOnFulfillment(fulfillment)
      // Business event logging handled by logFulfillmentProcessingIntentNotFound method
    })

    it('should update the intent as solved if it exists', async () => {
      const model = {
        face: 1,
        status: 'PENDING',
      }
      intentModel.findOne = jest.fn().mockReturnValue(model)
      await utilsIntentService.updateOnFulfillment(fulfillment)
      expect(intentModel.updateOne).toHaveBeenCalledTimes(1)
      expect(intentModel.updateOne).toHaveBeenCalledWith(
        { 'intent.hash': fulfillment.args._hash },
        { ...model, status: 'SOLVED' },
      )
    })
  })
})
