import { Test, TestingModule } from '@nestjs/testing'
import { BullModule } from '@nestjs/bull'
import { Queue } from 'bull'
import { DeepMocked, createMock } from '@golevelup/nestjs-testing'
import { MultichainPublicClientService, EcoConfigService, EcoAnalyticsService } from '@libs/integrations'
import { QUEUES } from '@libs/shared'
import { WatchCreateIntentService } from '../watch-create-intent.service'

describe('WatchIntentService', () => {
  let watchIntentService: WatchCreateIntentService
  let publicClientService: DeepMocked<MultichainPublicClientService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()

  const sources = [
    { chainID: 1n, sourceAddress: '0x1234', provers: ['0x88'], network: 'testnet1' },
    { chainID: 2n, sourceAddress: '0x5678', provers: ['0x88', '0x99'], network: 'testnet2' },
  ] as any
  const supportedChains = sources.map((s) => BigInt(s.chainID))

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        WatchCreateIntentService,
        {
          provide: MultichainPublicClientService,
          useValue: createMock<MultichainPublicClientService>(),
        },
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

    watchIntentService = chainMod.get(WatchCreateIntentService)
    publicClientService = chainMod.get(MultichainPublicClientService)
    ecoConfigService = chainMod.get(EcoConfigService)
    queue = chainMod.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))

    watchIntentService['logger'].debug = mockLogDebug
    watchIntentService['logger'].log = mockLogLog
    watchIntentService['logger'].error = mockLogError
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
  })

  describe('on lifecycle', () => {
    describe('on startup', () => {
      it('should subscribe to nothing if no source intents', async () => {
        const mock = jest.spyOn(watchIntentService, 'subscribe')
        await watchIntentService.onApplicationBootstrap()
        expect(mock).toHaveBeenCalledTimes(1)
      })

      it('should subscribe to all source intents', async () => {
        const mockWatch = jest.fn()
        publicClientService.getClient.mockResolvedValue({
          watchContractEvent: mockWatch,
        } as any)
        ecoConfigService.getIntentSources.mockReturnValue(sources)
        ecoConfigService.getSolvers.mockReturnValue(sources)
        await watchIntentService.onApplicationBootstrap()
        expect(mockWatch).toHaveBeenCalledTimes(2)

        for (const [index, s] of sources.entries()) {
          const { address, eventName, args } = mockWatch.mock.calls[index][0]
          const partial = { address, eventName, args }
          expect(partial).toEqual({
            address: s.sourceAddress,
            eventName: 'IntentCreated',
            args: { prover: s.provers },
          })
        }
      })
    })

    describe('on destroy', () => {
      it('should unsubscribe to nothing if no source intents', async () => {
        const mock = jest.spyOn(watchIntentService, 'unsubscribe')
        await watchIntentService.onModuleDestroy()
        expect(mock).toHaveBeenCalledTimes(1)
      })

      it('should unsubscribe to all source intents', async () => {
        const mockUnwatch = jest.fn()
        publicClientService.getClient.mockResolvedValue({
          watchContractEvent: () => mockUnwatch,
        } as any)
        ecoConfigService.getIntentSources.mockReturnValue(sources)
        ecoConfigService.getSolvers.mockReturnValue(sources)
        await watchIntentService.onApplicationBootstrap()
        await watchIntentService.onModuleDestroy()
        expect(mockUnwatch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('on intent', () => {
    const s = sources[0]
    const log: any = { logIndex: 2, args: { hash: '0x1' } as Partial<IntentCreatedLog['args']> }
    let mockQueueAdd: jest.SpyInstance<Promise<Job<any, any, string>>>

    beforeEach(async () => {
      mockQueueAdd = jest.spyOn(queue, 'add')
      await watchIntentService.addJob(s)([log])
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
    })
    it('should convert all bigints to strings', async () => {
      expect(mockLogDebug.mock.calls[0][0].createIntent).toEqual(
        expect.objectContaining(serialize(log)),
      )
    })

    it('should should attach source chainID and network', async () => {
      expect(mockLogDebug.mock.calls[0][0].createIntent).toEqual(
        expect.objectContaining(
          serialize({
            sourceChainID: s.chainID,
            sourceNetwork: s.network,
          }),
        ),
      )
    })

    it('should should enque a job for every intent', async () => {
      expect(mockQueueAdd).toHaveBeenCalledTimes(1)
      expect(mockQueueAdd).toHaveBeenCalledWith(
        QUEUES.SOURCE_INTENT.jobs.create_intent,
        expect.any(Object),
        { jobId: 'watch-create-intent-0x1-2' },
      )
    })
  })

  describe('on unsubscribe', () => {
    let mockUnwatch1: jest.Mock = jest.fn()
    let mockUnwatch2: jest.Mock = jest.fn()
    beforeEach(async () => {
      mockUnwatch1 = jest.fn()
      mockUnwatch2 = jest.fn()
      watchIntentService['unwatch'] = {
        1: mockUnwatch1,
        2: mockUnwatch2,
      }
    })

    afterEach(async () => {
      jest.clearAllMocks()
    })

    it('should unsubscribe to every unwatch and catch any throws', async () => {
      const e = new Error('test')
      mockUnwatch1.mockImplementation(() => {
        throw e
      })
      await watchIntentService.unsubscribe()
      expect(mockUnwatch1).toHaveBeenCalledTimes(1)
      expect(mockUnwatch2).toHaveBeenCalledTimes(1)
      expect(mockLogError).toHaveBeenCalledTimes(1)
      expect(mockLogError).toHaveBeenCalledWith({
        msg: 'watch-event: unsubscribe',
        error: EcoError.WatchEventUnsubscribeError.toString(),
        errorPassed: e,
      })
    })

    it('should unsubscribe to every unwatch', async () => {
      await watchIntentService.unsubscribe()
      expect(mockUnwatch1).toHaveBeenCalledTimes(1)
      expect(mockUnwatch2).toHaveBeenCalledTimes(1)
      expect(mockLogError).toHaveBeenCalledTimes(0)
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
      expect(mockLogDebug).toHaveBeenCalledWith({
        msg: 'watch-event: unsubscribe',
      })
    })
  })

  describe('on unsubscribeFrom', () => {
    let mockUnwatch1: jest.Mock = jest.fn()
    const chainID = 1
    beforeEach(async () => {
      mockUnwatch1 = jest.fn()
      watchIntentService['unwatch'] = {
        [chainID]: mockUnwatch1,
      }
    })

    afterEach(async () => {
      jest.clearAllMocks()
    })

    describe('on unwatch exists', () => {
      it('should unsubscribe to unwatch', async () => {
        await watchIntentService.unsubscribeFrom(chainID)
        expect(mockUnwatch1).toHaveBeenCalledTimes(1)
        expect(mockLogDebug).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledTimes(0)
        expect(mockLogDebug).toHaveBeenCalledWith({
          msg: 'watch-event: unsubscribeFrom',
          chainID,
        })
      })

      it('should unsubscribe to unwatch and catch throw', async () => {
        const e = new Error('test')
        mockUnwatch1.mockImplementation(() => {
          throw e
        })
        await watchIntentService.unsubscribeFrom(chainID)
        expect(mockUnwatch1).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledWith({
          msg: 'watch-event: unsubscribeFrom',
          error: EcoError.WatchEventUnsubscribeFromError(chainID).toString(),
          errorPassed: e,
          chainID,
        })
      })
    })

    describe('on unwatch doesnt exist', () => {
      beforeEach(async () => {
        watchIntentService['unwatch'] = {}
      })

      it('should log error', async () => {
        await watchIntentService.unsubscribeFrom(chainID)
        expect(mockUnwatch1).toHaveBeenCalledTimes(0)
        expect(mockLogError).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledWith({
          msg: 'watch event: unsubscribeFrom',
          error: EcoError.WatchEventNoUnsubscribeError(chainID).toString(),
          chainID,
        })
      })
    })
  })
})
