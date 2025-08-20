const mockGetIntentJobId = jest.fn()
const mockDelay = jest.fn().mockResolvedValue(undefined)
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '@libs/config-core'
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { Model } from 'mongoose'
import { ValidateIntentService } from '../validate-intent.service'
import { UtilsIntentService } from '../utils-intent.service'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Queue } from 'bullmq'
import { ValidationService } from '@eco-solver/intent/validation.sevice'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { zeroHash } from 'viem'
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service'
import { EcoError } from '@eco-solver/common/errors/eco-error'

jest.mock('../../common/utils/strings', () => {
  return {
    ...jest.requireActual('../../common/utils/strings'),
    getIntentJobId: mockGetIntentJobId,
  }
})

jest.mock('@/common/utils/time', () => ({
  delay: mockDelay,
}))

describe('ValidateIntentService', () => {
  let validateIntentService: ValidateIntentService
  let validationService: DeepMocked<ValidationService>
  let multichainPublicClientService: DeepMocked<MultichainPublicClientService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>
  const mockLogDebug = jest.fn()
  const mockLog = jest.fn()
  const mockLogError = jest.fn()

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateIntentService,
        {
          provide: UtilsIntentService,
          useValue: createMock<UtilsIntentService>(),
        },
        { provide: ValidationService, useValue: createMock<ValidationService>() },
        {
          provide: MultichainPublicClientService,
          useValue: createMock<MultichainPublicClientService>(),
        },
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

    validateIntentService = chainMod.get(ValidateIntentService)
    validationService = chainMod.get(ValidationService)
    multichainPublicClientService = chainMod.get(MultichainPublicClientService)
    utilsIntentService = chainMod.get(UtilsIntentService)
    ecoConfigService = chainMod.get(EcoConfigService)
    queue = chainMod.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))

    validateIntentService['logger'].debug = mockLogDebug
    validateIntentService['logger'].log = mockLog
    validateIntentService['logger'].error = mockLogError

    ecoConfigService.getIntentConfigs.mockReturnValue({
      intentFundedRetries: 3,
      intentFundedRetryDelayMs: 2000,
    } as any)
    validateIntentService.onModuleInit()
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.resetAllMocks()
  })

  describe('on module init', () => {
    it('should set the intentJobConfig', () => {
      const config = { a: 1 } as any
      ecoConfigService.getRedis = jest
        .fn()
        .mockReturnValueOnce({ jobs: { intentJobConfig: config } })
      validateIntentService.onModuleInit()
      expect(validateIntentService['intentJobConfig']).toEqual(config)
    })
  })

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

    it('should throw generic error if no error returned', async () => {
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

  describe('on validateIntent entrypoint', () => {
    it('should log when entering function and return on failed destructure', async () => {
      const intentHash = '0x1'
      validateIntentService['destructureIntent'] = jest
        .fn()
        .mockReturnValueOnce({ model: undefined, solver: undefined })
      expect(await validateIntentService.validateIntent(intentHash)).toBe(false)
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
      expect(mockLogDebug).toHaveBeenCalledWith({
        msg: `validateIntent ${intentHash}`,
        intentHash,
      })
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
      expect(mockLogDebug).toHaveBeenLastCalledWith({
        msg: `validateIntent ${intentHash}`,
        intentHash,
        jobId,
      })
    })
  })

  describe('on assertValidations', () => {
    const model = { intent: { hash: '0x12' } } as any
    const solver = {} as any
    const validations = { isIntentFunded: false, supportedSelectors: true } as any
    const validValidations = { isIntentFunded: true, supportedSelectors: true } as any
    let mockValidations: jest.Mock
    let mockIntentFunded: jest.SpyInstance
    let mockUpdateModel: jest.Mock

    beforeEach(() => {
      mockValidations = jest.fn().mockResolvedValue(validations)
      mockIntentFunded = jest.spyOn(validateIntentService, 'intentFunded').mockResolvedValue(true)
      mockUpdateModel = jest.fn()

      validationService.assertValidations = mockValidations
      utilsIntentService.updateInvalidIntentModel = mockUpdateModel
    })

    afterEach(() => {
      mockIntentFunded.mockRestore()
    })

    it('should return false if ValidationService is false', async () => {
      expect(await validateIntentService.assertValidations(model, solver)).toBe(false)
      expect(mockValidations).toHaveBeenCalledTimes(1)
      expect(mockIntentFunded).toHaveBeenCalledTimes(1)
      expect(mockUpdateModel).toHaveBeenCalledTimes(1)
      expect(mockLog).toHaveBeenCalledTimes(1)
      expect(mockLog).toHaveBeenCalledWith({
        msg: EcoError.IntentValidationFailed(model.intent.hash).message,
        model,
        validations,
      })
      expect(mockUpdateModel).toHaveBeenCalledWith(model, validations)
    })

    it('should return false if intentFunded returns false', async () => {
      mockValidations.mockResolvedValue(validValidations)
      mockIntentFunded.mockResolvedValueOnce(false)

      expect(await validateIntentService.assertValidations(model, solver)).toBe(false)
      expect(mockValidations).toHaveBeenCalledTimes(1)
      expect(mockIntentFunded).toHaveBeenCalledTimes(1)
      expect(mockUpdateModel).toHaveBeenCalledTimes(1)
      expect(mockLog).toHaveBeenCalledTimes(1)
      expect(mockLog).toHaveBeenCalledWith({
        msg: EcoError.IntentValidationFailed(model.intent.hash).message,
        model,
        validations: validValidations,
      })
      expect(mockUpdateModel).toHaveBeenCalledWith(model, validValidations)
    })

    it('should return true if intentFunded and ValidationService are all true ', async () => {
      mockValidations.mockResolvedValue(validValidations)
      mockIntentFunded.mockResolvedValue(true)

      expect(await validateIntentService.assertValidations(model, solver)).toBe(true)
      expect(mockValidations).toHaveBeenCalledTimes(1)
      expect(mockIntentFunded).toHaveBeenCalledTimes(1)
      expect(mockUpdateModel).toHaveBeenCalledTimes(0)
      expect(mockLog).toHaveBeenCalledTimes(0)
    })
  })

  describe('on intentFunded', () => {
    const chainID = 1
    const model = { intent: { hash: '0x12', route: { source: chainID } } } as any

    it('should return false if no intentSource for intent', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSource').mockReturnValue(undefined)

      expect(await validateIntentService.intentFunded(model)).toBe(false)
      expect(mockLogError).toHaveBeenCalledTimes(1)
      expect(mockLogError).toHaveBeenCalledWith({
        msg: EcoError.IntentSourceNotFound(chainID).message,
        model,
      })
    })

    it('should return true if isIntentFunded contract call returns true', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSource').mockReturnValue({ face: 'face' } as any)
      const mockRead = jest.fn().mockReturnValue(true)
      const client = { readContract: mockRead }
      multichainPublicClientService.getClient = jest.fn().mockReturnValue(client)

      expect(await validateIntentService.intentFunded(model)).toBe(true)
      expect(mockLogError).toHaveBeenCalledTimes(0)
      expect(mockRead).toHaveBeenCalledTimes(1)
    })

    it('should retry up to MAX_RETRIES times if intent is not funded', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSource').mockReturnValue({ face: 'face' } as any)
      const mockRead = jest.fn().mockResolvedValue(false)
      const client = { readContract: mockRead }
      multichainPublicClientService.getClient = jest.fn().mockReturnValue(client)

      const result = await validateIntentService.intentFunded(model)

      expect(result).toBe(false)
      expect(mockRead).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
      expect(mockDelay).toHaveBeenCalledTimes(3) // Delays for each retry
      expect(mockDelay).toHaveBeenNthCalledWith(1, 2000, 0) // RETRY_DELAY_MS, i=0
      expect(mockDelay).toHaveBeenNthCalledWith(2, 2000, 1) // RETRY_DELAY_MS, i=1
      expect(mockDelay).toHaveBeenNthCalledWith(3, 2000, 2) // RETRY_DELAY_MS, i=2
    })

    it('should return true on the second attempt', async () => {
      jest.spyOn(ecoConfigService, 'getIntentSource').mockReturnValue({ face: 'face' } as any)
      const mockRead = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      const client = { readContract: mockRead }
      multichainPublicClientService.getClient = jest.fn().mockReturnValue(client)

      const result = await validateIntentService.intentFunded(model)

      expect(result).toBe(true)
      expect(mockRead).toHaveBeenCalledTimes(2) // 1 initial + 1 retry
      expect(mockDelay).toHaveBeenCalledTimes(1)
      expect(mockDelay).toHaveBeenCalledWith(2000, 0) // First retry with i=0
    })
  })
})
