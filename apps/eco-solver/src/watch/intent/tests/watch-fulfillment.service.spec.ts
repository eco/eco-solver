import { QUEUES } from '@/common/redis/constants'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { WatchFulfillmentService } from '@/watch/intent/watch-fulfillment.service'
import { EcoAnalyticsService } from '@/analytics'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { Test, TestingModule } from '@nestjs/testing'
import { Job, Queue } from 'bullmq'

describe('WatchFulfillmentService', () => {
  let watchFulfillmentService: WatchFulfillmentService
  let publicClientService: DeepMocked<MultichainPublicClientService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()

  const inboxes = [
    { chainID: 1, inboxAddress: '0x1234' },
    { chainID: 2, inboxAddress: '0x5678' },
  ] as any
  const inboxRecord = inboxes.reduce((acc, solver) => {
    acc[solver.chainID] = solver
    return acc
  }, {})
  const supportedChains = inboxes.map((s) => BigInt(s.chainID))

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        WatchFulfillmentService,
        {
          provide: MultichainPublicClientService,
          useValue: createMock<MultichainPublicClientService>(),
        },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
      ],
      imports: [
        BullModule.registerQueue({
          name: QUEUES.INBOX.queue,
        }),
      ],
    })
      .overrideProvider(getQueueToken(QUEUES.INBOX.queue))
      .useValue(createMock<Queue>())
      .compile()

    watchFulfillmentService = chainMod.get(WatchFulfillmentService)
    publicClientService = chainMod.get(MultichainPublicClientService)
    ecoConfigService = chainMod.get(EcoConfigService)
    queue = chainMod.get(getQueueToken(QUEUES.INBOX.queue))

    watchFulfillmentService['logger'].debug = mockLogDebug
    watchFulfillmentService['logger'].log = mockLogLog
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
  })

  describe('on lifecycle', () => {
    describe('on startup', () => {
      it('should subscribe to nothing if no solvers', async () => {
        const mock = jest.spyOn(watchFulfillmentService, 'subscribe')
        await watchFulfillmentService.onApplicationBootstrap()
        expect(mock).toHaveBeenCalledTimes(1)
      })

      it('should subscribe to all solvers', async () => {
        const mockWatch = jest.fn()
        publicClientService.getClient.mockResolvedValue({
          watchContractEvent: mockWatch,
        } as any)
        ecoConfigService.getSolvers.mockReturnValue(inboxRecord)
        watchFulfillmentService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
        await watchFulfillmentService.onApplicationBootstrap()
        expect(mockWatch).toHaveBeenCalledTimes(2)

        for (const [index, s] of inboxes.entries()) {
          const { address, eventName, args } = mockWatch.mock.calls[index][0]
          const partial = { address, eventName, args }
          expect(partial).toEqual({
            address: s.inboxAddress,
            eventName: 'Fulfillment',
            args: { _sourceChainID: supportedChains },
          })
        }
      })
    })

    describe('on destroy', () => {
      it('should unsubscribe to nothing if no solvers', async () => {
        const mock = jest.spyOn(watchFulfillmentService, 'unsubscribe')
        await watchFulfillmentService.onModuleDestroy()
        expect(mock).toHaveBeenCalledTimes(1)
      })

      it('should unsubscribe to all solvers', async () => {
        const mockUnwatch = jest.fn()
        publicClientService.getClient.mockResolvedValue({
          watchContractEvent: () => mockUnwatch,
        } as any)
        ecoConfigService.getSolvers.mockReturnValue(inboxRecord)
        await watchFulfillmentService.onApplicationBootstrap()
        await watchFulfillmentService.onModuleDestroy()
        expect(mockUnwatch).toHaveBeenCalledTimes(2)
      })
    })

    describe('on fulfillment', () => {
      const log = { args: { _hash: BigInt(1), logIndex: BigInt(2) } } as any
      let mockQueueAdd: jest.SpyInstance<Promise<Job<any, any, string>>>

      beforeEach(async () => {
        mockQueueAdd = jest.spyOn(queue, 'add')
        await watchFulfillmentService.addJob()([log])
        expect(mockLogDebug).toHaveBeenCalledTimes(1)
      })

      it('should convert all bigints to strings', async () => {
        expect(mockLogDebug.mock.calls[0][0].fulfillment).toEqual(
          expect.objectContaining({
            args: { _hash: log.args._hash.toString(), logIndex: log.args.logIndex.toString() },
          }),
        )
      })

      it('should should enque a job for every intent', async () => {
        expect(mockQueueAdd).toHaveBeenCalledTimes(1)
        expect(mockQueueAdd).toHaveBeenCalledWith(
          QUEUES.INBOX.jobs.fulfillment,
          expect.any(Object),
          { jobId: 'watch-fulfillement-1-0' },
        )
      })
    })
  })
})
