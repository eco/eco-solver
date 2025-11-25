import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Test, TestingModule } from '@nestjs/testing'
import { ProofService } from '../../prover/proof.service'
import { RetryInfeasableIntentsService } from '@/intervals/retry-infeasable-intents.service'
import { Queue } from 'bullmq'
import { getModelToken } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Hex } from 'viem'
import { ProofType } from '@/contracts'

describe('RetryInfeasableIntentsService', () => {
  let infeasableService: RetryInfeasableIntentsService
  let proofService: DeepMocked<ProofService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let intervalQueue: DeepMocked<Queue>
  let intentQueue: DeepMocked<Queue>
  let intentSourceModel: DeepMocked<Model<IntentSourceModel>>

  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        RetryInfeasableIntentsService,
        {
          provide: getModelToken(IntentSourceModel.name),
          useValue: createMock<Model<IntentSourceModel>>(),
        },
        { provide: ProofService, useValue: createMock<ProofService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
      ],
      imports: [
        BullModule.registerQueue({
          name: QUEUES.INTERVAL.queue,
        }),
        BullModule.registerQueue({
          name: QUEUES.SOURCE_INTENT.queue,
        }),
      ],
    })
      .overrideProvider(getQueueToken(QUEUES.INTERVAL.queue))
      .useValue(createMock<Queue>())
      .overrideProvider(getQueueToken(QUEUES.SOURCE_INTENT.queue))
      .useValue(createMock<Queue>())
      .compile()

    //turn off the services from logging durring testing
    chainMod.useLogger(false)
    infeasableService = chainMod.get(RetryInfeasableIntentsService)
    proofService = chainMod.get(ProofService)
    ecoConfigService = chainMod.get(EcoConfigService)
    intentSourceModel = chainMod.get(getModelToken(IntentSourceModel.name))
    intervalQueue = chainMod.get(getQueueToken(QUEUES.INTERVAL.queue))
    intentQueue = chainMod.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))

    infeasableService['logger'].debug = mockLogDebug
    infeasableService['logger'].log = mockLogLog
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
  })

  describe('on startup', () => {
    const mockInternals = {
      retryInfeasableIntents: {
        repeatOpts: {
          every: 10000,
        },
        jobTemplate: {
          name: 'retry-infeasable-intents',
          data: {},
        },
      },
    }
    beforeEach(async () => {
      ecoConfigService.getIntervals.mockReturnValue(mockInternals as any)
    })

    it('should set intentJobConfig', async () => {
      await infeasableService.onModuleInit()
      expect(ecoConfigService.getIntervals).toHaveBeenCalledTimes(1)
    })

    it('should set upsertJobScheduler', async () => {
      await infeasableService.onApplicationBootstrap()
      expect(ecoConfigService.getIntervals).toHaveBeenCalledTimes(1)
      expect(intervalQueue.upsertJobScheduler).toHaveBeenCalledTimes(1)
      expect(intervalQueue.upsertJobScheduler).toHaveBeenCalledWith(
        QUEUES.INTERVAL.jobs.RETRY_INFEASABLE_INTENTS,
        { ...mockInternals.retryInfeasableIntents.repeatOpts, immediately: true },
        {
          ...mockInternals.retryInfeasableIntents.jobTemplate,
          name: QUEUES.INTERVAL.jobs.retry_infeasable_intents,
        },
      )
    })
  })

  describe('on retryInfeasableIntents', () => {
    let mockGetInfeasableIntents = jest.fn()
    const mockModels = [
      { intent: { hash: 'hash1', logIndex: 1 } },
      { intent: { hash: 'hash2', logIndex: 2 } },
    ]
    beforeEach(async () => {
      infeasableService['getInfeasableIntents'] = mockGetInfeasableIntents
      mockGetInfeasableIntents.mockResolvedValue(mockModels)
    })

    it('should log models retrieved', async () => {
      await infeasableService.retryInfeasableIntents()
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
      expect(mockLogDebug).toHaveBeenCalledWith({
        msg: 'retryInfeasableIntents',
        models: mockModels,
      })
    })

    it('should add every model to the queue', async () => {
      const addSpy = jest.spyOn(intentQueue, 'add')
      await infeasableService.retryInfeasableIntents()
      expect(addSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('getInfeasableIntents', () => {
    it('should fetch intents with status INFEASABLE and valid expiration for Hyperlane proofs', async () => {
      const minDateHyper = new Date('2022-01-01')
      const minDateMetalayer = new Date('2022-01-02')
      const minDateCcip = new Date('2022-01-03')
      const proverHyper: Hex[] = ['0x1a', '0x2a']
      const proverMetalayer: Hex[] = ['0x3b', '0x4b']
      const proverCcip: Hex[] = ['0x5c', '0x6c']
      const proofConfigs = ProofType.getAllProofTypes().map((proof) => {
        if (proof === ProofType.HYPERLANE)
          return { proof, minDate: minDateHyper, provers: proverHyper }
        if (proof === ProofType.METALAYER)
          return { proof, minDate: minDateMetalayer, provers: proverMetalayer }
        if (proof === ProofType.CCIP) return { proof, minDate: minDateCcip, provers: proverCcip }
        throw new Error('Unhandled proof type')
      })
      const mockGetProofMinimumDate = jest
        .spyOn(proofService, 'getProofMinimumDate')
        .mockImplementation((proof) => {
          const match = proofConfigs.find((config) => config.proof === proof)
          if (!match) throw new Error('Unexpected proof type')
          return match.minDate
        })
      const mockGetProvers = jest.spyOn(proofService, 'getProvers').mockImplementation((proof) => {
        const match = proofConfigs.find((config) => config.proof === proof)
        if (!match) throw new Error('Unexpected proof type')
        return match.provers
      })

      await infeasableService['getInfeasableIntents']()

      expect(intentSourceModel.find).toHaveBeenCalledWith({
        status: 'INFEASABLE',
        $or: proofConfigs.map(({ minDate, provers }) => ({
          'intent.expiration': { $gt: minDate },
          'intent.prover': { $in: provers },
        })),
      })

      expect(mockGetProofMinimumDate).toHaveBeenCalledTimes(proofConfigs.length)
      expect(mockGetProvers).toHaveBeenCalledTimes(proofConfigs.length)
    })
  })
})
