import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Test, TestingModule } from '@nestjs/testing'
import { ProofService } from '../../prover/proof.service'
import { MultichainPublicClientService } from '../../transaction/multichain-public-client.service'
import { RetryInfeasableIntentsService } from '@/intervals/retry-infeasable-intents.service'
import { Queue } from 'bullmq'
import { getModelToken } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'

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
        { provide: getQueueToken(QUEUES.INTERVAL.queue), useValue: createMock<Queue>() },
        { provide: getQueueToken(QUEUES.SOURCE_INTENT.queue), useValue: createMock<Queue>() },
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
      // .overrideProvider(getQueueToken(QUEUES.INTERVAL.queue))
      // .useValue(createMock<Queue>())
      // .overrideProvider(getQueueToken(QUEUES.SOURCE_INTENT.queue))
      // .useValue(createMock<Queue>())
      .compile()

    //turn off the services from logging durring testing
    chainMod.useLogger(false)
    infeasableService = chainMod.get(RetryInfeasableIntentsService)
    proofService = chainMod.get(ProofService)
    ecoConfigService = chainMod.get(EcoConfigService)
    intentSourceModel = chainMod.get(getModelToken(IntentSourceModel.name))
    intervalQueue = chainMod.get(getQueueToken(QUEUES.INTERVAL.queue))
    intentQueue = chainMod.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))
    proofService['logger'].debug = mockLogDebug
    proofService['logger'].log = mockLogLog
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
  })

  describe('on startup', () => {
    it('should call loadProofTypes', async () => {
      const mockLoad = jest.fn()
      proofService['loadProofTypes'] = mockLoad
      await proofService.onModuleInit()
      expect(mockLoad).toHaveBeenCalledTimes(1)
    })
  })
})