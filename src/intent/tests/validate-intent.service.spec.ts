const mockGetIntentJobId = jest.fn()
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { Model } from 'mongoose'
import { ValidateIntentService } from '../validate-intent.service'
import { ProofService } from '../../prover/proof.service'
import { UtilsIntentService } from '../utils-intent.service'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Queue } from 'bullmq'
import { zeroHash } from 'viem'
import { entries } from 'lodash'

jest.mock('../../common/utils/strings', () => {
  return {
    ...jest.requireActual('../../common/utils/strings'),
    getIntentJobId: mockGetIntentJobId,
  }
})

describe('ValidateIntentService', () => {
  let validateIntentService: ValidateIntentService
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let proofService: DeepMocked<ProofService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateIntentService,
        {
          provide: UtilsIntentService,
          useValue: createMock<UtilsIntentService>(),
        },
        { provide: ProofService, useValue: createMock<ProofService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
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

    validateIntentService = chainMod.get(ValidateIntentService)
    utilsIntentService = chainMod.get(UtilsIntentService)
    proofService = chainMod.get(ProofService)
    ecoConfigService = chainMod.get(EcoConfigService)
    queue = chainMod.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))

    validateIntentService['logger'].debug = mockLogDebug
    validateIntentService['logger'].log = mockLogLog
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
  })

  describe('on individual validation cases', () => {
    describe('on destructureIntent', () => {
      it('should throw if get intent returns no data', async () => {
        utilsIntentService.getIntentProcessData.mockResolvedValueOnce(undefined)
        await expect(validateIntentService['destructureIntent'](zeroHash)).rejects.toThrow(
          'Desctructuring the intent from the intent hash failed',
        )
      })

      it('should throw if solver is undefined', async () => {
        utilsIntentService.getIntentProcessData.mockResolvedValueOnce({ model: {} } as any)
        await expect(validateIntentService['destructureIntent'](zeroHash)).rejects.toThrow(
          'Desctructuring the intent from the intent hash failed',
        )
      })

      it('should throw if model is undefined', async () => {
        utilsIntentService.getIntentProcessData.mockResolvedValueOnce({ solver: {} } as any)
        await expect(validateIntentService['destructureIntent'](zeroHash)).rejects.toThrow(
          'Desctructuring the intent from the intent hash failed',
        )
      })

      it('should throw error if its returned', async () => {
        const msg = 'Error from getIntentProcessData'
        utilsIntentService.getIntentProcessData.mockResolvedValueOnce({
          err: new Error(msg),
        } as any)
        await expect(validateIntentService['destructureIntent'](zeroHash)).rejects.toThrow('Error')
      })

      it('should throw generic error in no error returned', async () => {
        utilsIntentService.getIntentProcessData.mockResolvedValueOnce({} as any)
        await expect(validateIntentService['destructureIntent'](zeroHash)).rejects.toThrow(
          'Desctructuring the intent from the intent hash failed',
        )
      })

      it('should succeed and return data', async () => {
        const dataIn = { model: {}, solver: {} } as any
        utilsIntentService.getIntentProcessData.mockResolvedValueOnce(dataIn)
        const dataOut = await validateIntentService['destructureIntent'](zeroHash)
        expect(dataOut).toBe(dataIn)
      })
    })

    describe('on supportedProver', () => {
      const sourceChainID = 1n
      const chainID = sourceChainID
      const prover = '0xcf25397DC87C750eEF006101172FFbeAeA98Aa76'
      const unsupportedChain = 2n
      const unsupportedProver = '0x26D2C47c5659aC8a1c4A29A052Fa7B2ccD45Ca43'
      it('should fail if no source intent exists with the models source chain id', async () => {
        const model = { event: { sourceChainID } } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([])
        expect(validateIntentService['supportedProver'](model)).toBe(false)
      })

      it('should fail if no source supports the prover', async () => {
        const model = { event: { sourceChainID }, intent: { prover } } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [unsupportedProver], chainID } as any,
        ])
        expect(validateIntentService['supportedProver'](model)).toBe(false)
      })

      it('should fail if no source supports the prover on the required chain', async () => {
        const model = { event: { sourceChainID }, intent: { prover } } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [prover], chainID: unsupportedChain } as any,
        ])
        expect(validateIntentService['supportedProver'](model)).toBe(false)
      })

      it('should succeed if a single source supports the prover', async () => {
        const model = { event: { sourceChainID }, intent: { prover } } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [unsupportedProver], chainID } as any,
          { provers: [prover], chainID } as any,
        ])
        expect(validateIntentService['supportedProver'](model)).toBe(true)
      })

      it('should succeed if multiple sources supports the prover', async () => {
        const model = { event: { sourceChainID }, intent: { prover } } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [prover], chainID } as any,
          { provers: [prover], chainID } as any,
        ])
        expect(validateIntentService['supportedProver'](model)).toBe(true)
      })
    })
    describe('on supportedTargets', () => {
      //mostly covered in utilsIntentService
      it('should return whatever UtilsIntentService does', async () => {
        const model = {} as any
        const solver = {} as any
        utilsIntentService.targetsSupported.mockReturnValueOnce(true)
        expect(validateIntentService['supportedTargets'](model, solver)).toBe(true)
        utilsIntentService.targetsSupported.mockReturnValueOnce(false)
        expect(validateIntentService['supportedTargets'](model, solver)).toBe(false)
      })
    })
    describe('on supportedSelectors', () => {
      //mostly covered in utilsIntentService
      it('should return whatever UtilsIntentService does', async () => {
        const model = {} as any
        const solver = {} as any
        utilsIntentService.selectorsSupported.mockReturnValueOnce(true)
        expect(validateIntentService['supportedSelectors'](model, solver)).toBe(true)
        utilsIntentService.selectorsSupported.mockReturnValueOnce(false)
        expect(validateIntentService['supportedSelectors'](model, solver)).toBe(false)
      })
    })
    describe('on validExpirationTime', () => {
      //mostly covered in utilsIntentService
      it('should return whatever UtilsIntentService does', async () => {
        const model = { intent: { expiryTime: 100 } } as any
        proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValueOnce(true)
        expect(validateIntentService['validExpirationTime'](model)).toBe(true)
        proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValueOnce(false)
        expect(validateIntentService['validExpirationTime'](model)).toBe(false)
      })
    })

    describe('on fulfillOnDifferentChain', () => {
      it('should fail if the fulfillment is on the same chain as the event', async () => {
        const model = { intent: { destinationChainID: 10 }, event: { sourceChainID: 10 } } as any
        proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValueOnce(true)
        expect(validateIntentService['fulfillOnDifferentChain'](model)).toBe(false)
      })

      it('should succeed if the fulfillment is on a different chain as the event', async () => {
        const model = { intent: { destinationChainID: 10 }, event: { sourceChainID: 20 } } as any
        proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValueOnce(true)
        expect(validateIntentService['fulfillOnDifferentChain'](model)).toBe(true)
      })
    })
  })

  describe('on assertValidations', () => {
    const updateInvalidIntentModel = jest.fn()
    const assetCases = {
      supportedProver: 'proverUnsupported',
      supportedTargets: 'targetsUnsupported',
      supportedSelectors: 'selectorsUnsupported',
      validExpirationTime: 'expiresEarly',
      sameChainFulfill: 'sameChainFulfill',
    }
    beforeEach(() => {
      utilsIntentService.updateInvalidIntentModel = updateInvalidIntentModel
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should fail on equal rewards arrays', async () => {
      const model = {
        intent: { rewardTokens: [1, 2], rewardAmounts: [3, 4, 5], destinationChainID: 10 },
        event: { sourceChainID: 10 },
      } as any
      const solver = {} as any
      expect(await validateIntentService['assertValidations'](model, solver)).toBe(false)
      expect(mockLogLog).toHaveBeenCalledTimes(1)
      expect(mockLogLog).toHaveBeenCalledWith({
        intent: model.intent,
        msg: 'validateIntent: Rewards mismatch',
      })
    })

    entries(assetCases).forEach(([fun, boolVarName]: [string, string]) => {
      it(`should fail on ${fun}`, async () => {
        const model = {
          intent: {
            rewardTokens: [1, 2],
            rewardAmounts: [3, 4],
            hash: '0x1',
            destinationChainID: 10,
          },
          event: { sourceChainID: 11 },
        } as any
        const solver = {} as any
        const logObj = entries(assetCases).reduce(
          (ac, [, a]) => ({ ...ac, [a]: a == boolVarName }),
          {},
        )
        if (boolVarName == 'sameChainFulfill') {
          model.intent.destinationChainID = model.event.sourceChainID
        }
        const now = new Date()
        proofService.getProofMinimumDate = jest.fn().mockReturnValueOnce(now)
        validateIntentService[fun] = jest.fn().mockReturnValueOnce(false)
        expect(await validateIntentService['assertValidations'](model, solver)).toBe(false)
        expect(updateInvalidIntentModel).toHaveBeenCalledTimes(1)
        expect(mockLogLog).toHaveBeenCalledTimes(1)
        expect(updateInvalidIntentModel).toHaveBeenCalledWith(model, logObj)
        expect(mockLogLog).toHaveBeenCalledWith({
          msg: `Intent failed validation ${model.intent.hash}`,
          model,
          ...logObj,
          ...(boolVarName == 'expiresEarly' && { proofMinDurationSeconds: now.toUTCString() }),
        })
      })
    })
  })

  describe('on validateIntent entrypoint', () => {
    it('should log when entering function and return on failed destructure', async () => {
      const intentHash = '0x1'
      validateIntentService['destructureIntent'] = jest
        .fn()
        .mockReturnValueOnce({ model: undefined, solver: undefined })
      expect(await validateIntentService.validateIntent(intentHash)).toBe(false)
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
      expect(mockLogDebug).toHaveBeenCalledWith({ msg: `validateIntent ${intentHash}`, intentHash })
    })

    it('should return on failed assertions', async () => {
      const intentHash = '0x1'
      validateIntentService['destructureIntent'] = jest
        .fn()
        .mockReturnValueOnce({ model: {}, solver: {} })
      validateIntentService['assertValidations'] = jest.fn().mockReturnValueOnce(false)
      expect(await validateIntentService.validateIntent(intentHash)).toBe(false)
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
    })

    it('should log, create a job and enque it', async () => {
      const intentHash = '0x1'
      const model = { intent: { logIndex: 10 } }
      const config = { a: 1 } as any
      validateIntentService['destructureIntent'] = jest
        .fn()
        .mockReturnValueOnce({ model, solver: {} })
      validateIntentService['assertValidations'] = jest.fn().mockReturnValueOnce(true)
      validateIntentService['intentJobConfig'] = config
      const mockAddQueue = jest.fn()
      queue.add = mockAddQueue
      const jobId = 'validate-asdf-0'
      mockGetIntentJobId.mockReturnValueOnce(jobId)
      expect(await validateIntentService.validateIntent(intentHash)).toBe(true)
      expect(mockGetIntentJobId).toHaveBeenCalledTimes(1)
      expect(mockAddQueue).toHaveBeenCalledTimes(1)
      expect(mockLogDebug).toHaveBeenCalledTimes(2)
      expect(mockGetIntentJobId).toHaveBeenCalledWith('validate', intentHash, model.intent.logIndex)
      expect(mockAddQueue).toHaveBeenCalledWith(
        QUEUES.SOURCE_INTENT.jobs.feasable_intent,
        intentHash,
        {
          jobId,
          ...validateIntentService['intentJobConfig'],
        },
      )
      expect(mockLogDebug).toHaveBeenCalledWith({
        msg: `validateIntent ${intentHash}`,
        intentHash,
        jobId,
      })
    })
  })
})
