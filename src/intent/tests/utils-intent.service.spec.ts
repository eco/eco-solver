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
import { TargetCallViemType } from '@/contracts'

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
          proverUnsupported: true,
          targetsUnsupported: false,
          selectorsUnsupported: false,
          expiresEarly: false,
          validDestination: false,
          sameChainFulfill: false,
        }
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
        const infeasable = [
          {
            solvent: true,
            profitable: false,
          },
        ]
        await utilsIntentService.updateInfeasableIntentModel(model, infeasable)
        expect(mockUpdateOne).toHaveBeenCalledTimes(1)
        expect(mockUpdateOne).toHaveBeenCalledWith(
          { 'intent.hash': model.intent.hash },
          { ...model, status: 'INFEASABLE', receipt: infeasable },
        )
      })
    })
  })

  describe('on selectorsSupported', () => {
    it('should return false when target length is 0', async () => {
      const model = { intent: { route: { calls: [] } } } as any
      expect(utilsIntentService.selectorsSupported(model, {} as any)).toBe(false)
      expect(mockLogLog).toHaveBeenCalledTimes(1)
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: 'validateIntent: Target/data invalid',
        intent: model.intent,
      })
    })

    it('should return false some target transactions fail to decode', async () => {
      const model = {
        intent: {
          route: {
            calls: [
              { target: address1, data: '0x11' },
              { target: address2, data: '0x22' },
            ],
          },
        },
      } as any
      utilsIntentService.getTransactionTargetData = jest
        .fn()
        .mockImplementation((model, solver, call) => {
          if (call.target === address2) return null
          return { decoded: true }
        })
      expect(utilsIntentService.selectorsSupported(model, {} as any)).toBe(false)
    })

    it('should return true when all target transactions decode', async () => {
      const model = {
        intent: {
          route: {
            calls: [
              { target: address1, data: '0x11' },
              { target: address2, data: '0x22' },
            ],
          },
        },
      } as any
      utilsIntentService.getTransactionTargetData = jest.fn().mockReturnValue({ decoded: true })
      expect(utilsIntentService.selectorsSupported(model, {} as any)).toBe(true)
    })
  })

  describe('on getTransactionTargetData', () => {
    const callData: TargetCallViemType = { target: address1, data: '0xa9059cbb3333333', value: 0n } //transfer selector plus data fake
    const selectors = ['transfer(address,uint256)']
    const targetConfig = { contractType: 'erc20', selectors }
    const decodedData = { stuff: true }

    it('should throw when no target config exists on solver', async () => {
      const model = { intent: { targets: [address1], data: ['0x11'] } } as any
      const solver = { targets: {} }
      expect(() =>
        utilsIntentService.getTransactionTargetData(model, solver as any, callData),
      ).toThrow(EcoError.IntentSourceTargetConfigNotFound(callData.target as string))
    })

    it('should return null when tx is not decoded ', async () => {
      const model = {
        intent: { route: { calls: [callData] }, hash: '0x3' },
        event: { sourceNetwork: 'opt-sepolia' },
      } as any
      mockDecodeFunctionData.mockReturnValue(null)
      expect(
        utilsIntentService.getTransactionTargetData(
          model,
          { targets: { [address1]: { contractType: 'erc20', selectors } } } as any,
          callData,
        ),
      ).toBe(null)
      expect(mockLogLog).toHaveBeenCalledTimes(1)
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `Selectors not supported for intent ${model.intent.hash}`,
        intentHash: model.intent.hash,
        sourceNetwork: model.event.sourceNetwork,
        unsupportedSelector: getFunctionBytes(callData.data),
      })
    })

    it('should return null when target selector is not supported by the solver', async () => {
      const fakeData = '0xaaaaaaaa11112333'
      const call: TargetCallViemType = { target: callData.target, data: fakeData, value: 0n }
      const model = {
        intent: { route: { calls: [call] }, hash: '0x3' },
        event: { sourceNetwork: 'opt-sepolia' },
      } as any
      mockDecodeFunctionData.mockReturnValue(decodedData)
      expect(
        utilsIntentService.getTransactionTargetData(
          model,
          { targets: { [address1]: { contractType: 'erc20', selectors } } } as any,
          call,
        ),
      ).toBe(null)
      expect(mockLogLog).toHaveBeenCalledTimes(1)
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `Selectors not supported for intent ${model.intent.hash}`,
        intentHash: model.intent.hash,
        sourceNetwork: model.event.sourceNetwork,
        unsupportedSelector: getFunctionBytes(fakeData),
      })
    })

    it('should return the decoded function data, selctor and target config when successful', async () => {
      const model = {
        intent: { route: { calls: [callData] }, hash: '0x3' },
        event: { sourceNetwork: 'opt-sepolia' },
      } as any
      mockDecodeFunctionData.mockReturnValue(decodedData)
      expect(
        utilsIntentService.getTransactionTargetData(
          model,
          { targets: { [address1]: targetConfig } } as any,
          callData,
        ),
      ).toEqual({
        decodedFunctionData: decodedData,
        selector: getFunctionBytes(callData.data),
        targetConfig,
      })
    })
  })

  describe('on targetsSupported', () => {
    const target = address1
    const target1 = address2
    const targetConfig = { contractType: 'erc20', selectors: [] }

    it('should return false if model targets are empty', async () => {
      const model = {
        intent: { route: { calls: [] }, hash: '0x9' },
        event: { sourceNetwork: 'opt-sepolia' },
      } as any
      const solver = { targets: { address1: { contractType: 'erc20', selectors: [] } } }
      expect(utilsIntentService.targetsSupported(model, solver as any)).toBe(false)
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
      expect(mockLogDebug).toHaveBeenCalledWith({
        msg: `Targets not supported for intent ${model.intent.hash}`,
        intentHash: model.intent.hash,
        sourceNetwork: model.event.sourceNetwork,
      })
    })

    it('should return false if solver targets are empty', async () => {
      const model = {
        intent: { route: { calls: [{ target, data: '0x' }] }, hash: '0x9' },
        event: { sourceNetwork: 'opt-sepolia' },
      } as any
      const solver = { targets: {} }
      expect(utilsIntentService.targetsSupported(model, solver as any)).toBe(false)
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
      expect(mockLogDebug).toHaveBeenCalledWith({
        msg: `Targets not supported for intent ${model.intent.hash}`,
        intentHash: model.intent.hash,
        sourceNetwork: model.event.sourceNetwork,
      })
    })

    it('should return false if solver doesn`t support the targets of the model', async () => {
      const model = {
        intent: { route: { calls: [{ target, data: '0x' }] }, hash: '0x9' },
        event: { sourceNetwork: 'opt-sepolia' },
      } as any
      const solver = { targets: { [target1]: targetConfig } }
      expect(utilsIntentService.targetsSupported(model, solver as any)).toBe(false)
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
      expect(mockLogDebug).toHaveBeenCalledWith({
        msg: `Targets not supported for intent ${model.intent.hash}`,
        intentHash: model.intent.hash,
        sourceNetwork: model.event.sourceNetwork,
      })
    })

    it('should return true if model targets are a subset of solver targets', async () => {
      const model = {
        intent: { route: { calls: [{ target, data: '0x' }] }, hash: '0x9' },
        event: { sourceNetwork: 'opt-sepolia' },
      } as any
      const solver = { targets: { [target]: targetConfig, [target1]: targetConfig } }
      expect(utilsIntentService.targetsSupported(model, solver as any)).toBe(true)
    })
  })

  describe('on getIntentProcessData', () => {
    const intentHash = address1
    const model = {
      intent: { route: { hash: intentHash, destination: '85432' } },
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
      expect(await utilsIntentService.getIntentProcessData(intentHash)).toBe(undefined)
      expect(mockLogLog).toHaveBeenCalledTimes(1)
      expect(mockLogLog).toHaveBeenCalledWith({
        msg: `No solver found for chain ${model.intent.route.destination}`,
        intentHash: intentHash,
        sourceNetwork: model.event.sourceNetwork,
      })
    })

    it('should throw an error if model db throws (permissions issue usually)', async () => {
      const mockLogError = jest.fn()
      utilsIntentService['logger'].error = mockLogError
      const err = new Error('DB error')
      intentModel.findOne = jest.fn().mockRejectedValue(err)
      expect(await utilsIntentService.getIntentProcessData(intentHash)).toBe(undefined)
      expect(mockLogError).toHaveBeenCalledTimes(1)
      expect(mockLogError).toHaveBeenCalledWith({
        msg: `Error in getIntentProcessData ${intentHash}`,
        intentHash: intentHash,
        error: err,
      })
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
    it('should log a warning if no intent exists in the db for the fulfillment hash', async () => {
      intentModel.findOne = jest.fn().mockReturnValue(undefined)
      await utilsIntentService.updateOnFulfillment(fulfillment)
      expect(mockLogWarn).toHaveBeenCalledTimes(1)
      expect(mockLogWarn).toHaveBeenCalledWith({
        msg: `Intent not found for fulfillment ${fulfillment.args._hash}`,
        fulfillment,
      })
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
