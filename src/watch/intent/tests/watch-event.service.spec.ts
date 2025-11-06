import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Queue } from 'bullmq'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoAnalyticsService } from '@/analytics'
import { WatchEventService } from '@/watch/intent/watch-event.service'

type TestContract = { chainID: number }

class TestWatchEventService extends WatchEventService<TestContract> {
  async subscribe(): Promise<void> {
    // no-op for tests
  }
  async subscribeTo(): Promise<void> {
    // overwritten by spies in tests
  }
  addJob(): (logs: any[]) => Promise<void> {
    return async () => {}
  }
}

describe('WatchEventService (base)', () => {
  let service: TestWatchEventService
  let queue: DeepMocked<Queue>
  let publicClientService: DeepMocked<MultichainPublicClientService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let analytics: DeepMocked<EcoAnalyticsService>

  const mockLogDebug = jest.fn()
  const mockLogWarn = jest.fn()
  const mockLogError = jest.fn()

  beforeEach(() => {
    queue = createMock<Queue>()
    publicClientService = createMock<MultichainPublicClientService>()
    ecoConfigService = createMock<EcoConfigService>()
    analytics = createMock<EcoAnalyticsService>()

    service = new TestWatchEventService(queue, publicClientService, ecoConfigService, analytics)

    // hijack logger
    ;(service as any)['logger'].debug = mockLogDebug
    ;(service as any)['logger'].warn = mockLogWarn
    ;(service as any)['logger'].error = mockLogError
  })

  afterEach(() => {
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogWarn.mockClear()
    mockLogError.mockClear()
  })

  describe('lifecycle hooks', () => {
    it('loads watch job config and backoff settings on init', async () => {
      const watchJobConfig = { removeOnComplete: 10 } as any
      ;(ecoConfigService.getRedis as jest.Mock).mockReturnValue({ jobs: { watchJobConfig } })
      ;(ecoConfigService.getWatch as jest.Mock).mockReturnValue({
        recoveryBackoffBaseMs: 111,
        recoveryBackoffMaxMs: 222,
        recoveryStabilityWindowMs: 333,
      })

      await service.onModuleInit()

      expect((service as any)['watchJobConfig']).toBe(watchJobConfig)
      expect((service as any)['recoveryBackoffBaseMs']).toBe(111)
      expect((service as any)['recoveryBackoffMaxMs']).toBe(222)
      expect((service as any)['recoveryStabilityWindowMs']).toBe(333)
    })

    it('calls subscribe on application bootstrap', async () => {
      const spy = jest.spyOn(service, 'subscribe').mockResolvedValue()
      await service.onApplicationBootstrap()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('unsubscribe', () => {
    it('unsubscribes all and tracks analytics on error', async () => {
      const ok = jest.fn()
      const boom = jest.fn(() => {
        throw new Error('boom')
      })
      ;(service as any)['unwatch'] = { 1: ok, 2: boom }

      await service.unsubscribe()

      expect(ok).toHaveBeenCalledTimes(1)
      expect(boom).toHaveBeenCalledTimes(1)
      // when an unwatch throws, we log + track analytics; non-throwing entries are removed
      expect(Object.keys((service as any)['unwatch']).length).toBe(1)
      expect(mockLogError).toHaveBeenCalledTimes(1)
      expect(analytics.trackError).toHaveBeenCalled()
    })

    it('unsubscribeFrom removes and logs debug', async () => {
      const unwatch = jest.fn()
      ;(service as any)['unwatch'] = { 7: unwatch }

      await service.unsubscribeFrom(7)

      expect(unwatch).toHaveBeenCalledTimes(1)
      expect(mockLogDebug).toHaveBeenCalledTimes(1)
      expect((service as any)['unwatch'][7]).toBeUndefined()
    })

    it('unsubscribeFrom logs error and tracks analytics on thrown unwatch', async () => {
      const unwatch = jest.fn(() => {
        throw new Error('test')
      })
      ;(service as any)['unwatch'] = { 9: unwatch }

      await service.unsubscribeFrom(9)

      expect(mockLogError).toHaveBeenCalledTimes(1)
      expect(analytics.trackError).toHaveBeenCalled()
    })

    it('unsubscribeFrom logs error when nothing to unsubscribe', async () => {
      ;(service as any)['unwatch'] = {}
      await service.unsubscribeFrom(42)
      expect(mockLogError).toHaveBeenCalledTimes(1)
    })
  })

  describe('recovery (onError)', () => {
    const chainID = 1
    const contract: TestContract = { chainID }
    const client: any = { getBlockNumber: jest.fn().mockResolvedValue(0n) }

    beforeEach(() => {
      // set backoff config since onModuleInit isn't always called
      ;(service as any)['recoveryBackoffBaseMs'] = 1_000
      ;(service as any)['recoveryBackoffMaxMs'] = 30_000
      ;(service as any)['recoveryStabilityWindowMs'] = 60_000
      // make delay instant
      ;(service as any)['delay'] = jest.fn().mockResolvedValue(undefined)
    })

    it('returns early if recovery already in progress', async () => {
      ;(service as any)['recoveryInProgress'][chainID] = true
      const subSpy = jest.spyOn(service as any, 'subscribeTo')
      const unsubSpy = jest.spyOn(service as any, 'unsubscribeFrom')
      await service.onError(new Error('e'), client, contract)
      expect(unsubSpy).not.toHaveBeenCalled()
      expect(subSpy).not.toHaveBeenCalled()
      expect((service as any)['recoveryIgnoredAttempts'][chainID]).toBe(1)
      expect(analytics.trackWatchErrorOccurred).not.toHaveBeenCalled()
    })

    it('applies backoff and resubscribes successfully', async () => {
      ;(service as any)['recoveryAttempts'][chainID] = 2 // -> 4s
      const delaySpy = jest.spyOn(service as any, 'delay')
      const unsubSpy = jest.spyOn(service as any, 'unsubscribeFrom').mockResolvedValue(undefined)
      const subSpy = jest.spyOn(service as any, 'subscribeTo').mockResolvedValue(undefined)

      await service.onError(new Error('rpc'), client, contract)

      expect(delaySpy).toHaveBeenCalledWith(4000)
      expect(unsubSpy).toHaveBeenCalledWith(chainID)
      expect(subSpy).toHaveBeenCalledWith(client, contract)
      expect((service as any)['recoveryAttempts'][chainID]).toBe(3)
      expect((service as any)['recoveryInProgress'][chainID]).toBe(false)
      expect((service as any)['recoveryIgnoredAttempts'][chainID]).toBe(0)
      expect(analytics.trackWatchErrorRecoveryStarted).toHaveBeenCalled()
      expect(analytics.trackWatchErrorOccurred).toHaveBeenCalled()
      expect(analytics.trackWatchErrorRecoverySuccess).toHaveBeenCalled()
    })

    it('backfills missed logs before resubscribe when cursor exists', async () => {
      ;(service as any)['lastProcessedBlockByChain'][chainID] = 10n
      const fetchSpy = jest
        .spyOn(service as any, 'fetchBackfillLogs')
        .mockResolvedValue([{ blockNumber: 11n }] as any)
      const addJob = jest
        .spyOn(service, 'addJob')
        .mockReturnValue(jest.fn().mockResolvedValue(undefined) as any)
      jest.spyOn(service as any, 'unsubscribeFrom').mockResolvedValue(undefined)
      jest.spyOn(service as any, 'subscribeTo').mockResolvedValue(undefined)
      client.getBlockNumber = jest.fn().mockResolvedValueOnce(12n)

      await service.onError(new Error('rpc'), client, contract)

      expect(fetchSpy).toHaveBeenCalledWith(client, contract, 11n, 12n)
      expect(addJob).toHaveBeenCalled()
    })

    it('skips backfill when latest block is behind cursor', async () => {
      ;(service as any)['lastProcessedBlockByChain'][chainID] = 10n
      const fetchSpy = jest.spyOn(service as any, 'fetchBackfillLogs')
      jest.spyOn(service as any, 'unsubscribeFrom').mockResolvedValue(undefined)
      jest.spyOn(service as any, 'subscribeTo').mockResolvedValue(undefined)
      client.getBlockNumber = jest.fn().mockResolvedValueOnce(8n)

      await service.onError(new Error('rpc'), client, contract)

      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('logs warning on backfill failure but still resubscribes', async () => {
      ;(service as any)['lastProcessedBlockByChain'][chainID] = 10n
      jest
        .spyOn(service as any, 'fetchBackfillLogs')
        .mockRejectedValueOnce(new Error('backfill failed'))
      jest.spyOn(service as any, 'unsubscribeFrom').mockResolvedValue(undefined)
      const subSpy = jest.spyOn(service as any, 'subscribeTo').mockResolvedValue(undefined)
      client.getBlockNumber = jest.fn().mockResolvedValueOnce(12n)

      await service.onError(new Error('rpc'), client, contract)

      expect(mockLogWarn).toHaveBeenCalled()
      expect(subSpy).toHaveBeenCalled()
    })

    it('tracks failure when resubscribe throws', async () => {
      jest.spyOn(service as any, 'unsubscribeFrom').mockResolvedValue(undefined)
      jest
        .spyOn(service as any, 'subscribeTo')
        .mockRejectedValueOnce(new Error('resubscribe failed'))

      await expect(service.onError(new Error('rpc'), client, contract)).rejects.toThrow(
        'resubscribe failed',
      )

      expect(analytics.trackWatchErrorRecoveryStarted).toHaveBeenCalled()
      expect(analytics.trackWatchErrorRecoveryFailed).toHaveBeenCalled()
      expect((service as any)['delay']).toHaveBeenCalledWith(expect.any(Number))
    })
  })

  describe('helpers', () => {
    it('records and advances next from block correctly', () => {
      const chainID = 5
      // no existing
      expect((service as any)['getNextFromBlock'](chainID)).toBeUndefined()
      ;(service as any)['recordProcessedBlock'](chainID, 10n)
      expect((service as any)['getNextFromBlock'](chainID)).toBe(11n)
      // does not regress
      ;(service as any)['recordProcessedBlock'](chainID, 9n)
      expect((service as any)['getNextFromBlock'](chainID)).toBe(11n)
      // advances when higher
      ;(service as any)['recordProcessedBlock'](chainID, 20n)
      expect((service as any)['getNextFromBlock'](chainID)).toBe(21n)
    })

    it('processLogsResiliently logs concise summary on failures', async () => {
      const logs = [1, 2, 3]
      const handler = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined)

      await (service as any)['processLogsResiliently'](logs, handler, 'unit test')
      expect(handler).toHaveBeenCalledTimes(3)
      expect(mockLogError).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'unit test: 1/3 jobs failed to be added to queue' }),
      )
    })
  })

  describe('getPollingInterval', () => {
    it('returns MIN when solver missing or non-positive averageBlockTime', () => {
      ;(ecoConfigService.getSolver as jest.Mock).mockReturnValue(undefined)
      const min = (service as any)['MIN_POLLING_INTERVAL']
      expect((service as any)['getPollingInterval'](1)).toBe(min)
      ;(ecoConfigService.getSolver as jest.Mock).mockReturnValue({ averageBlockTime: 0 })
      expect((service as any)['getPollingInterval'](1)).toBe(min)
      ;(ecoConfigService.getSolver as jest.Mock).mockReturnValue({ averageBlockTime: 1 })
      expect((service as any)['getPollingInterval'](1)).toBe(min)
    })

    it('returns seconds * 1000 when averageBlockTime > 1', () => {
      ;(ecoConfigService.getSolver as jest.Mock).mockReturnValue({ averageBlockTime: 3 })
      expect((service as any)['getPollingInterval'](1)).toBe(3000)
    })
  })
})
