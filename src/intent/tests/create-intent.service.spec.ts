const mockDecodeCreateIntentLog = jest.fn()
const mockDecodeEventLog = jest.fn()
const mockDecodeAbiParameters = jest.fn()

import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { CreateIntentService } from '../create-intent.service'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoAnalyticsService } from '@/analytics'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { FlagService } from '../../flags/flags.service'
import { getModelToken } from '@nestjs/mongoose'
import { IntentDataModel } from '../schemas/intent-data.schema'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { Model } from 'mongoose'
import { Queue } from 'bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Test, TestingModule } from '@nestjs/testing'
import { ValidSmartWalletService } from '../../solver/filters/valid-smart-wallet.service'

jest.mock('../../contracts', () => {
  return {
    ...jest.requireActual('../../contracts'),
    decodeCreateIntentLog: mockDecodeCreateIntentLog,
  }
})

// Mock viem functions
jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    decodeEventLog: mockDecodeEventLog,
    decodeAbiParameters: mockDecodeAbiParameters,
  }
})

// Set test timeout to prevent hanging
jest.setTimeout(10000)

describe('CreateIntentService', () => {
  let createIntentService: CreateIntentService
  let validSmartWalletService: DeepMocked<ValidSmartWalletService>
  let flagService: DeepMocked<FlagService>
  let intentSourceRepository: IntentSourceRepository
  let queue: DeepMocked<Queue>
  let module: TestingModule
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()

  // Store original IntentDataModel.fromEvent method
  const originalFromEvent = IntentDataModel.fromEvent

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        CreateIntentService,
        IntentSourceRepository,
        {
          provide: getModelToken(IntentSourceModel.name),
          useValue: createMock<Model<IntentSourceModel>>(),
        },
        { provide: ValidSmartWalletService, useValue: createMock<ValidSmartWalletService>() },
        { provide: FlagService, useValue: createMock<FlagService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
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
    //turn off the services from logging durring testing
    module.useLogger(false)

    createIntentService = module.get(CreateIntentService)
    intentSourceRepository = module.get(IntentSourceRepository)
    validSmartWalletService = module.get(ValidSmartWalletService)
    flagService = module.get(FlagService)
    queue = module.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))

    createIntentService['logger'].debug = mockLogDebug
    createIntentService['logger'].log = mockLogLog
  })

  afterEach(async () => {
    // Clear all mocks first
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
    mockDecodeCreateIntentLog.mockClear()
    mockDecodeEventLog.mockClear()
    mockDecodeAbiParameters.mockClear()

    // Restore IntentDataModel.fromEvent to original state
    IntentDataModel.fromEvent = originalFromEvent

    // Clear all mock implementations and calls
    jest.clearAllMocks()

    // Restore all spy mocks
    jest.restoreAllMocks()

    // Close the NestJS module and cleanup resources
    if (module) {
      await module.close()
    }
  })

  describe('on createIntent', () => {
    const mockEvent = {
      creator: '0xaaa',
      data: '0xda',
      transactionHash: '0x123',
      topics: ['0x456'],
      sourceChainID: 85432,
      logIndex: 1,
      args: {
        intentHash: '0x9494',
      },
    }
    const mockIntent = {
      reward: { creator: '0xaaa' },
      hash: '0x9494',
      logIndex: 1,
    }
    const mockDecodedRoute = {
      salt: '0x123',
      deadline: 1234567890n,
      portal: '0xportal',
      nativeAmount: 0n,
      tokens: [],
      calls: [],
    }
    beforeEach(() => {
      mockDecodeCreateIntentLog.mockReturnValue({ hash: mockEvent.transactionHash })
      mockDecodeEventLog.mockReturnValue({
        args: {
          route: '0x123456',
        },
      })
      mockDecodeAbiParameters.mockReturnValue([mockDecodedRoute])
      const mockIntentSourceEvent = jest.fn().mockReturnValue(mockIntent)
      IntentDataModel.fromEvent = mockIntentSourceEvent
    })

    it('should decode the event', async () => {
      const mockQueryIntent = jest.fn().mockResolvedValue(null)
      intentSourceRepository.queryIntent = mockQueryIntent

      await createIntentService.createIntent(mockEvent as any)
      expect(mockLogDebug).toHaveBeenCalledWith({
        msg: `createIntent ${mockEvent.transactionHash}`,
        transactionHash: mockEvent.transactionHash,
        intentHash: mockEvent.args.intentHash,
      })
      expect(mockDecodeEventLog).toHaveBeenCalled()
      expect(mockDecodeAbiParameters).toHaveBeenCalled()
    })

    it('should return if model has already been created in db', async () => {
      const mockGetIntent = jest.fn().mockResolvedValue({ hash: mockEvent.transactionHash })
      intentSourceRepository.getIntent = mockGetIntent
      await createIntentService.createIntent(mockEvent as any)
      expect(mockGetIntent).toHaveBeenCalledWith(mockEvent.args.intentHash)
      expect(mockLogDebug).toHaveBeenNthCalledWith(2, {
        msg: `Record for intent already exists ${mockIntent.hash}`,
        intentHash: mockIntent.hash,
        intent: mockIntent,
      })
      expect(validSmartWalletService.validateSmartWallet).not.toHaveBeenCalled()
    })

    it('should check if the bendWalletOnly flag is up', async () => {
      const mockQueryIntent = jest.fn().mockResolvedValue(null)
      intentSourceRepository.queryIntent = mockQueryIntent
      const mockFlag = jest.spyOn(flagService, 'getFlagValue').mockReturnValue(false)
      const mockValidateSmartWallet = jest.fn().mockResolvedValue(true)
      validSmartWalletService.validateSmartWallet = mockValidateSmartWallet
      await createIntentService.createIntent(mockEvent as any)
      expect(mockFlag).toHaveBeenCalledWith('bendWalletOnly')
      expect(mockValidateSmartWallet).toHaveBeenCalledTimes(0)
    })

    it('should validate the intent is from a bend wallet', async () => {
      const mockQueryIntent = jest.fn().mockResolvedValue(null)
      intentSourceRepository.queryIntent = mockQueryIntent
      const mockValidateSmartWallet = jest.fn().mockResolvedValue(true)
      jest.spyOn(flagService, 'getFlagValue').mockReturnValue(true)
      validSmartWalletService.validateSmartWallet = mockValidateSmartWallet
      const mockQueueAdd = jest.fn().mockResolvedValue({})
      queue.add = mockQueueAdd
      await createIntentService.createIntent(mockEvent as any)
      expect(mockValidateSmartWallet).toHaveBeenCalledTimes(1)
      expect(mockValidateSmartWallet).toHaveBeenCalledWith(
        mockIntent.reward.creator,
        mockEvent.sourceChainID,
      )
    })

    it('should create an intent model in the database', async () => {
      const mockQueryIntent = jest.fn().mockResolvedValue(null)
      intentSourceRepository.queryIntent = mockQueryIntent
      const mockValidateSmartWallet = jest.fn().mockResolvedValue(true)
      jest.spyOn(flagService, 'getFlagValue').mockReturnValue(true)
      validSmartWalletService.validateSmartWallet = mockValidateSmartWallet
      jest.spyOn(intentSourceRepository, 'create').mockResolvedValue({ intent: mockIntent } as any)

      const mockQueueAdd = jest.fn().mockResolvedValue({})
      queue.add = mockQueueAdd

      await createIntentService.createIntent(mockEvent as any)
      expect(intentSourceRepository.create).toHaveBeenCalledWith({
        event: mockEvent,
        intent: mockIntent,
        receipt: null,
        status: 'PENDING',
      })

      mockValidateSmartWallet.mockResolvedValueOnce(false)
      await createIntentService.createIntent(mockEvent as any)
      expect(intentSourceRepository.create).toHaveBeenCalledWith({
        event: mockEvent,
        intent: mockIntent,
        receipt: null,
        status: 'NON-BEND-WALLET',
      })
    })

    it('should not enqueue a job if the intent is not from a bend wallet', async () => {
      const mockQueryIntent = jest.fn().mockResolvedValue(null)
      const mockQueueAdd = jest.fn().mockResolvedValue({})
      intentSourceRepository.queryIntent = mockQueryIntent
      jest.spyOn(intentSourceRepository, 'create').mockResolvedValue({ intent: mockIntent } as any)
      queue.add = mockQueueAdd
      jest.spyOn(flagService, 'getFlagValue').mockReturnValue(true)
      validSmartWalletService.validateSmartWallet = jest.fn().mockResolvedValue(false)

      await createIntentService.createIntent(mockEvent as any)
      expect(mockQueueAdd).not.toHaveBeenCalled()
      expect(mockLogLog).toHaveBeenNthCalledWith(1, {
        msg: `Recorded intent ${mockIntent.hash}`,
        intentHash: mockIntent.hash,
        intent: mockIntent,
        validWallet: false,
      })
    })

    it('should enqueue a job if the intent is from a bend wallet', async () => {
      const mockQueryIntent = jest.fn().mockResolvedValue(null)
      const mockQueueAdd = jest.fn().mockResolvedValue({})
      intentSourceRepository.queryIntent = mockQueryIntent
      queue.add = mockQueueAdd
      jest.spyOn(intentSourceRepository, 'create').mockResolvedValue({ intent: mockIntent } as any)
      jest.spyOn(flagService, 'getFlagValue').mockReturnValue(true)
      validSmartWalletService.validateSmartWallet = jest.fn().mockResolvedValue(true)

      const jobId = `create-${mockIntent.hash}-${mockIntent.logIndex}`
      await createIntentService.createIntent(mockEvent as any)
      expect(mockQueueAdd).toHaveBeenCalledTimes(1)
      expect(mockQueueAdd).toHaveBeenCalledWith(
        QUEUES.SOURCE_INTENT.jobs.validate_intent,
        mockIntent.hash,
        expect.objectContaining({ jobId }),
      )

      expect(mockLogLog).toHaveBeenNthCalledWith(1, {
        msg: `Recorded intent ${mockIntent.hash}`,
        intentHash: mockIntent.hash,
        intent: mockIntent,
        validWallet: true,
        jobId,
      })
    })
  })

  afterAll(async () => {
    // Final cleanup to ensure all resources are released
    jest.clearAllTimers()
    jest.useRealTimers()
    await new Promise((resolve) => setImmediate(resolve))
  })
})
