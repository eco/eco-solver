import { QUEUES } from '@/common/redis/constants'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { WatchCreateIntentService } from '@/watch/intent/watch-create-intent.service'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { Test, TestingModule } from '@nestjs/testing'
import { Job, Queue } from 'bullmq'
import { EcoError } from '@/common/errors/eco-error'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { serialize } from '@/common/utils/serialize'
import { IntentCreatedLog } from '@/contracts'
import { EcoAnalyticsService } from '@/analytics'

describe('WatchIntentService', () => {
  let watchIntentService: WatchCreateIntentService
  let publicClientService: DeepMocked<MultichainPublicClientService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let ecoAnalyticsService: DeepMocked<EcoAnalyticsService>
  let queue: DeepMocked<Queue>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogWarn = jest.fn()
  const mockLogError = jest.fn()

  const sources = [
    { chainID: 1n, sourceAddress: '0x1234', provers: ['0x88'], network: 'testnet1' },
    { chainID: 2n, sourceAddress: '0x5678', provers: ['0x88', '0x99'], network: 'testnet2' },
  ] as any

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
    ecoAnalyticsService = chainMod.get(EcoAnalyticsService)
    queue = chainMod.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))

    watchIntentService['logger'].debug = mockLogDebug
    watchIntentService['logger'].log = mockLogLog
    watchIntentService['logger'].warn = mockLogWarn
    watchIntentService['logger'].error = mockLogError

    // Ensure solver mock returns numeric averageBlockTime per Solver type
    ecoConfigService.getSolver.mockReturnValue({ averageBlockTime: 2 } as any)
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
    mockLogWarn.mockClear()
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
          const { address, eventName, args, fromBlock } = mockWatch.mock.calls[index][0]
          const partial = { address, eventName, args }
          expect(partial).toEqual({
            address: s.sourceAddress,
            eventName: 'IntentPublished',
            args: { prover: s.provers },
          })
          expect(fromBlock).toBeUndefined()
        }
      })

      it('tracks analytics on subscribe success', async () => {
        const startSpy = jest.spyOn(
          ecoAnalyticsService,
          'trackWatchCreateIntentSubscriptionStarted',
        )
        const successSpy = jest.spyOn(
          ecoAnalyticsService,
          'trackWatchCreateIntentSubscriptionSuccess',
        )
        publicClientService.getClient.mockResolvedValue({
          watchContractEvent: jest.fn(),
        } as any)
        ecoConfigService.getIntentSources.mockReturnValue(sources)
        ecoConfigService.getSolvers.mockReturnValue(sources)

        await watchIntentService.subscribe()
        expect(startSpy).toHaveBeenCalledWith(sources)
        expect(successSpy).toHaveBeenCalledWith(sources)
      })

      it('tracks analytics on subscribe failure', async () => {
        const errorSpy = jest.spyOn(ecoAnalyticsService, 'trackError')
        publicClientService.getClient.mockResolvedValue({
          watchContractEvent: jest.fn(() => {
            throw new Error('boom')
          }),
        } as any)
        ecoConfigService.getIntentSources.mockReturnValue(sources)
        ecoConfigService.getSolvers.mockReturnValue(sources)

        await expect(watchIntentService.subscribe()).rejects.toThrow('boom')
        expect(errorSpy).toHaveBeenCalled()
      })

      it('passes stored fromBlock when resubscribing to a chain', async () => {
        const chainID = Number(sources[0].chainID)
        watchIntentService['lastProcessedBlockByChain'][chainID] = 42n
        const mockWatch = jest.fn().mockReturnValue(jest.fn())
        await watchIntentService.subscribeTo({ watchContractEvent: mockWatch } as any, sources[0])

        expect(mockWatch).toHaveBeenCalledWith(
          expect.objectContaining({
            fromBlock: 43n,
          }),
        )
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
    const log: any = {
      logIndex: 2,
      args: { intentHash: '0x1' } as Partial<IntentCreatedLog['args']>,
      blockNumber: 5n,
    }
    let mockQueueAdd: jest.SpyInstance<Promise<Job<any, any, string>>>

    beforeEach(async () => {
      mockQueueAdd = jest.spyOn(queue, 'add')
      await watchIntentService.addJob(s)([log])
      expect(mockLogDebug).toHaveBeenCalledTimes(2)
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

    it('records the highest processed block per chain from the batch', async () => {
      await watchIntentService.addJob(s)([
        { ...log, blockNumber: 8n },
        { ...log, blockNumber: 12n },
      ])

      expect(watchIntentService['lastProcessedBlockByChain'][Number(s.chainID)]).toBe(12n)
    })

    it('does not advance cursor past the earliest failed block within a batch', async () => {
      // Ensure no prior cursor
      delete watchIntentService['lastProcessedBlockByChain'][Number(s.chainID)]

      // Create three logs across consecutive blocks; make the middle one fail
      const logs: any[] = [
        { ...log, blockNumber: 100n, logIndex: 1, args: { intentHash: '0x1' } },
        { ...log, blockNumber: 101n, logIndex: 2, args: { intentHash: '0x1' } },
        { ...log, blockNumber: 102n, logIndex: 3, args: { intentHash: '0x1' } },
      ]

      const addSpy = jest.spyOn(queue, 'add')
      addSpy.mockImplementation((name: any, _data: any, opts: any) => {
        // Reject only the job for logIndex 2 (block 101)
        if (opts?.jobId?.endsWith('-2')) {
          return Promise.reject(new Error('enqueue failed'))
        }
        return Promise.resolve({} as any)
      })

      await watchIntentService.addJob(s)(logs as any)

      // Cursor should advance only to 100 (just before the earliest failed block 101)
      expect(watchIntentService['lastProcessedBlockByChain'][Number(s.chainID)]).toBe(100n)
    })

    it('skips cursor updates when logs lack block numbers', async () => {
      delete watchIntentService['lastProcessedBlockByChain'][Number(s.chainID)]

      await watchIntentService.addJob(s)([{ ...log, blockNumber: undefined } as any])

      expect(watchIntentService['lastProcessedBlockByChain'][Number(s.chainID)]).toBeUndefined()
    })

    it('tracks analytics when job is queued successfully', async () => {
      const spy = jest.spyOn(ecoAnalyticsService, 'trackWatchCreateIntentJobQueued')
      await watchIntentService.addJob(s)([log])
      expect(spy).toHaveBeenCalledWith(expect.any(Object), expect.any(String), s)
    })

    it('tracks analytics when job queue add fails but error is silenced', async () => {
      const err = new Error('queue down')
      mockQueueAdd.mockRejectedValueOnce(err)
      const analyticsSpy = jest.spyOn(ecoAnalyticsService, 'trackWatchJobQueueError')

      await watchIntentService.addJob(s)([log])
      expect(analyticsSpy).toHaveBeenCalledWith(
        err,
        expect.any(String),
        expect.objectContaining({
          createIntent: expect.any(Object),
          jobId: expect.any(String),
          source: s,
        }),
      )

      // Additional verification: check that the error was logged by processLogsResiliently
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'watch create-intent: 1/1 jobs failed to be added to queue',
          failures: ['queue down'],
        }),
      )
    })
  })

  describe('fetchBackfillLogs', () => {
    const source = sources[0]

    beforeEach(() => {
      ecoConfigService.getSupportedChains.mockReturnValue([BigInt(source.chainID)])
    })

    it('caps the range and filters unsupported destinations', async () => {
      const client = {
        getContractEvents: jest.fn().mockResolvedValue([
          {
            args: { destination: BigInt(source.chainID) },
            blockNumber: 20_400n,
          },
          {
            args: { destination: 999n },
            blockNumber: 20_300n,
          },
        ]),
      }

      const toBlock = 20_500n
      const fromBlock = 1n

      const logs = await (watchIntentService as any).fetchBackfillLogs(
        client as any,
        source,
        fromBlock,
        toBlock,
      )

      expect(client.getContractEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 10_500n,
          toBlock,
        }),
      )
      expect(logs).toHaveLength(1)
      expect(logs[0].blockNumber).toBe(20_400n)
    })
  })

  describe('on unsubscribe', () => {
    let mockUnwatch1: jest.Mock = jest.fn()
    let mockUnwatch2: jest.Mock = jest.fn()
    beforeEach(async () => {
      // ensure call counts from prior tests don't leak into this group
      mockLogError.mockClear()
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
      // Only one error should be logged for the thrown unwatch
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

    it('unsubscribe removes unwatch entries to prevent leaks', async () => {
      await watchIntentService.unsubscribe()
      expect(Object.keys(watchIntentService['unwatch']).length).toBe(0)
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

  describe('onError (recovery)', () => {
    const chainID = 1
    const client: any = {
      getBlockNumber: jest.fn().mockResolvedValue(0n),
    }
    const contract: any = { chainID } as any
    const error = new Error('rpc error')
    let fetchBackfillSpy: jest.SpyInstance
    let addJobSpy: jest.SpyInstance

    beforeEach(() => {
      // make delay instant to simplify tests
      ;(watchIntentService as any)['delay'] = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(watchIntentService as any, 'unsubscribeFrom').mockResolvedValue(undefined)
      jest.spyOn(watchIntentService as any, 'subscribeTo').mockResolvedValue(undefined)
      fetchBackfillSpy = jest
        .spyOn(watchIntentService as any, 'fetchBackfillLogs')
        .mockResolvedValue([])
      addJobSpy = jest
        .spyOn(watchIntentService, 'addJob')
        .mockReturnValue(jest.fn().mockResolvedValue(undefined) as any)
      // ensure backoff config is set (onModuleInit not invoked in these unit tests)
      ;(watchIntentService as any)['recoveryBackoffBaseMs'] = 1_000
      ;(watchIntentService as any)['recoveryBackoffMaxMs'] = 30_000
      ;(watchIntentService as any)['recoveryStabilityWindowMs'] = 60_000
    })

    afterEach(() => jest.clearAllMocks())

    it('returns early if recovery already in progress for chain', async () => {
      ;(watchIntentService as any)['recoveryInProgress'][chainID] = true
      const occurSpy = jest.spyOn(ecoAnalyticsService, 'trackWatchErrorOccurred')

      await watchIntentService.onError(error, client, contract)

      expect((watchIntentService as any).unsubscribeFrom).not.toHaveBeenCalled()
      expect((watchIntentService as any).subscribeTo).not.toHaveBeenCalled()
      // ignored counter increments and no error occurrence tracking happens on skipped attempts
      expect((watchIntentService as any)['recoveryIgnoredAttempts'][chainID]).toBe(1)
      expect(occurSpy).not.toHaveBeenCalled()
    })

    it('resubscribes after applying pre-attempt backoff when recovery succeeds; tracks context', async () => {
      ;(watchIntentService as any)['recoveryAttempts'][chainID] = 2 // 1s * 2^2 = 4s (capped below max)
      const delaySpy = jest.spyOn(watchIntentService as any, 'delay')
      const occurSpy = jest.spyOn(ecoAnalyticsService, 'trackWatchErrorOccurred')

      await watchIntentService.onError(error, client, contract)

      // Expect pre-attempt backoff to be applied: base 1000ms * 2^2 = 4000ms
      expect(delaySpy).toHaveBeenCalledWith(4000)
      expect((watchIntentService as any).unsubscribeFrom).toHaveBeenCalledWith(chainID)
      expect((watchIntentService as any).subscribeTo).toHaveBeenCalledWith(client, contract)
      // attempts increment and are not reset on immediate success
      expect((watchIntentService as any)['recoveryAttempts'][chainID]).toBe(3)
      // in-progress flag is cleared and ignored counter reset
      expect((watchIntentService as any)['recoveryInProgress'][chainID]).toBe(false)
      expect((watchIntentService as any)['recoveryIgnoredAttempts'][chainID]).toBe(0)

      // error occurrence tracking receives ignoredAttempts=0 and contract context
      expect(occurSpy).toHaveBeenCalledWith(
        error,
        expect.any(String),
        expect.objectContaining({ contract, ignoredAttempts: 0 }),
      )
    })

    it('backfills missed logs before resubscribing when a cursor exists', async () => {
      const addJobReturn = jest.fn().mockResolvedValue(undefined)
      ;(addJobSpy as jest.Mock).mockReturnValue(addJobReturn)
      const missedLog = { blockNumber: 11n } as any
      fetchBackfillSpy.mockResolvedValueOnce([missedLog])
      client.getBlockNumber.mockResolvedValueOnce(12n)
      watchIntentService['lastProcessedBlockByChain'][chainID] = 10n

      await watchIntentService.onError(error, client, contract)

      expect(client.getBlockNumber).toHaveBeenCalled()
      expect(fetchBackfillSpy).toHaveBeenCalledWith(client, contract, 11n, 12n)
      expect(addJobReturn).toHaveBeenCalledWith([missedLog])
    })

    it('skips backfill when latest block is behind the cursor', async () => {
      watchIntentService['lastProcessedBlockByChain'][chainID] = 10n
      client.getBlockNumber.mockResolvedValueOnce(8n)

      await watchIntentService.onError(error, client, contract)

      expect(fetchBackfillSpy).not.toHaveBeenCalled()
    })

    it('logs a warning when backfill fails but still resubscribes', async () => {
      watchIntentService['lastProcessedBlockByChain'][chainID] = 10n
      client.getBlockNumber.mockResolvedValueOnce(12n)
      const backfillError = new Error('backfill failed')
      fetchBackfillSpy.mockRejectedValueOnce(backfillError)

      await watchIntentService.onError(error, client, contract)

      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'watch-event: backfill failed',
          error: backfillError.toString(),
          chainID,
          fromBlock: 11n,
        }),
      )
      expect((watchIntentService as any).subscribeTo).toHaveBeenCalledWith(client, contract)
    })

    it('tracks analytics on recovery start and failure', async () => {
      const startSpy = jest.spyOn(ecoAnalyticsService, 'trackWatchErrorRecoveryStarted')
      const failSpy = jest.spyOn(ecoAnalyticsService, 'trackWatchErrorRecoveryFailed')

      ;(watchIntentService as any).subscribeTo.mockRejectedValueOnce(
        new Error('resubscribe failed'),
      )

      await expect(watchIntentService.onError(error, client, contract)).rejects.toThrow(
        'resubscribe failed',
      )

      expect(startSpy).toHaveBeenCalled()
      expect(failSpy).toHaveBeenCalled()
      expect((watchIntentService as any)['delay']).toHaveBeenCalledWith(expect.any(Number))
    })
  })
})
