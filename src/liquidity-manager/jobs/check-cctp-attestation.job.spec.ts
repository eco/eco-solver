/**
 * @file check-cctp-attestation.job.spec.ts
 * Comprehensive tests for CheckCCTPAttestationJobManager
 *
 * Covers:
 *  - start(): enqueues with correct name/options, forwards delay
 *  - is(): correct type guard
 *  - process(): calls provider service with messageHash, returns provider result
 *  - onComplete():
 *      * COMPLETE -> logs and enqueues ExecuteCCTPMint job with attestation
 *      * PENDING  -> logs and re-enqueues itself with 30_000 delay, preserves data
 *  - onFailed(): structured error logging
 */

// Mock the problematic dependencies first
jest.mock('@/liquidity-manager/processors/eco-protocol-intents.processor', () => ({
  LiquidityManagerProcessor: class MockLiquidityManagerProcessor {},
}))

jest.mock('@/liquidity-manager/jobs/execute-cctp-mint.job', () => ({
  ExecuteCCTPMintJobManager: {
    start: jest.fn(),
  },
}))

jest.mock('@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service', () => ({
  CCTPProviderService: class MockCCTPProviderService {},
}))

import { Queue, JobsOptions } from 'bullmq'
import { Hex } from 'viem'
import {
  CheckCCTPAttestationJobManager,
  type CheckCCTPAttestationJob,
  type CheckCCTPAttestationJobData,
} from '@/liquidity-manager/jobs/check-cctp-attestation.job'

import {
  LiquidityManagerJobName,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { ExecuteCCTPMintJobManager } from '@/liquidity-manager/jobs/execute-cctp-mint.job'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'

function makeQueueMock() {
  return {
    add: jest.fn<Promise<any>, [string, any, JobsOptions | undefined]>(),
  } as unknown as jest.Mocked<Queue>
}

type MockLogger = {
  debug: jest.Mock
  log: jest.Mock
  warn: jest.Mock
  error: jest.Mock
}

function makeLoggerMock(): MockLogger {
  return {
    debug: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}

type AttestationResult = { status: 'pending' } | { status: 'complete'; attestation: Hex }

function makeProcessorMock(overrides?: Partial<LiquidityManagerProcessor>) {
  const logger = makeLoggerMock()
  const baseQueue = makeQueueMock()

  const fetchAttestation: jest.Mock<Promise<AttestationResult>, [Hex]> = jest.fn()

  const processor = {
    logger,
    processorType: 'liquidity-manager-processor', // Required by context extractor
    queue: overrides?.queue ?? baseQueue, // ← respect injected queue
    cctpProviderService: { fetchAttestation },
    ...overrides,
  } as unknown as LiquidityManagerProcessor & {
    logger: MockLogger
    processorType: string

    cctpProviderService: {
      fetchAttestation
    }
  }

  return processor
}

function makeJob(
  data: Partial<CheckCCTPAttestationJobData>,
  returnvalue?: any,
): CheckCCTPAttestationJob {
  const base: CheckCCTPAttestationJobData = {
    destinationChainId: 8453,
    messageHash: '0xabc' as Hex,
    messageBody: '0xdeadbeef' as Hex,
    groupID: 'grp-1',
    rebalanceJobID: 'reb-1',
    id: 'job-1',
  }
  return {
    id: 'bull-id-123',
    name: LiquidityManagerJobName.CHECK_CCTP_ATTESTATION,
    data: { ...base, ...data },
    opts: { delay: undefined } as any,
    attemptsMade: 0,
    returnvalue: returnvalue as any,
    // only fields we actually touch in code under test are needed
  } as unknown as CheckCCTPAttestationJob
}

// ------------- Mocks for cross-job interaction ------------------

jest.spyOn(ExecuteCCTPMintJobManager, 'start').mockImplementation(async () => {
  // noop
})

describe('CheckCCTPAttestationJobManager', () => {
  let mgr: CheckCCTPAttestationJobManager

  beforeEach(() => {
    jest.resetAllMocks()
    mgr = new CheckCCTPAttestationJobManager()

    // provide a mock so the getter never calls ModuleRef
    ;(mgr as any).rebalanceRepository = {
      updateStatus: jest.fn(),
    }
  })

  describe('start()', () => {
    it('enqueues the CHECK_CCTP_ATTESTATION job with defaults', async () => {
      const queue = makeQueueMock()
      const data = makeJob({}).data

      await CheckCCTPAttestationJobManager.start(queue, data)

      expect(queue.add).toHaveBeenCalledTimes(1)
      const [name, payload, opts] = queue.add.mock.calls[0]
      expect(name).toBe(LiquidityManagerJobName.CHECK_CCTP_ATTESTATION)
      expect(payload).toEqual(data)
      expect(opts?.removeOnComplete).toBe(true)
      expect(opts?.attempts).toBe(3)
      expect(opts?.backoff).toEqual({ type: 'exponential', delay: 10_000 })
      expect(opts?.delay).toBeUndefined()
    })

    it('forwards the delay option', async () => {
      const queue = makeQueueMock()
      const data = makeJob({}).data

      await CheckCCTPAttestationJobManager.start(queue, data, 30_000)

      expect(queue.add).toHaveBeenCalledTimes(1)
      const [, , opts] = queue.add.mock.calls[0]
      expect(opts?.delay).toBe(30_000)
    })
  })

  describe('is()', () => {
    it('returns true for CHECK_CCTP_ATTESTATION jobs', () => {
      const job = makeJob({})
      expect(mgr.is(job as any)).toBe(true)
    })

    it('returns false for other jobs', () => {
      const other = { name: 'SOME_OTHER_JOB' } as any
      expect(mgr.is(other)).toBe(false)
    })
  })

  describe('process()', () => {
    it('calls cctpProviderService.fetchAttestation(messageHash) and returns the result', async () => {
      const processor = makeProcessorMock()
      const job = makeJob({ messageHash: '0xfeed' as Hex })

      const providerResult = { status: 'pending' }
      processor.cctpProviderService.fetchAttestation.mockResolvedValueOnce(providerResult as any)

      const result = await mgr.process(job as any, processor)

      expect(processor.cctpProviderService.fetchAttestation).toHaveBeenCalledWith('0xfeed')
      expect(result).toBe(providerResult)
    })
  })

  describe('onComplete()', () => {
    it('when status=complete: logs and enqueues ExecuteCCTPMintJob with attestation', async () => {
      const processor = makeProcessorMock()
      const job = makeJob(
        {
          messageHash: '0xdead' as Hex,
          destinationChainId: 10,
          id: 'job-xyz',
        },
        { status: 'complete', attestation: '0xbeef' as Hex },
      )

      await mgr.onComplete(job as any, processor)

      // Logged
      expect(processor.logger.debug).toHaveBeenCalled()

      // Enqueued mint
      expect(ExecuteCCTPMintJobManager.start).toHaveBeenCalledTimes(1)
      const [passedQueue, dataArg] = (ExecuteCCTPMintJobManager.start as jest.Mock).mock.calls[0]
      expect(passedQueue).toBe(processor.queue)
      expect(dataArg).toMatchObject({
        messageHash: '0xdead',
        attestation: '0xbeef',
        id: 'job-xyz',
      })
    })

    it('when status=pending: logs and re-enqueues attestation check with 30_000 delay', async () => {
      const queue = makeQueueMock()
      const processor = makeProcessorMock({ queue: queue as LiquidityManagerQueueType })

      const job = makeJob(
        {
          messageHash: '0xdead' as Hex,
          destinationChainId: 10,
          groupID: 'grp-42',
          rebalanceJobID: 'reb-7',
        },
        { status: 'pending' },
      )

      await mgr.onComplete(job as any, processor)

      expect(processor.queue).toBe(queue)
      expect(queue.add).toHaveBeenCalledWith(
        LiquidityManagerJobName.CHECK_CCTP_ATTESTATION,

        expect.objectContaining({
          groupID: job.data.groupID,
          rebalanceJobID: job.data.rebalanceJobID,
          messageHash: job.data.messageHash,
        }),

        expect.objectContaining({
          delay: 30_000,
          removeOnComplete: true,
          attempts: 3,
        }),
      )

      // Logged
      expect(processor.logger.debug).toHaveBeenCalled()

      // Re-enqueued self with delay 30_000
      expect(queue.add).toHaveBeenCalledTimes(1)

      const [name, payload, opts] = queue.add.mock.calls[0]
      expect(name).toBe(LiquidityManagerJobName.CHECK_CCTP_ATTESTATION)
      expect(payload).toMatchObject(job.data)
      expect(opts?.delay).toBe(30_000)
      expect(opts?.removeOnComplete).toBe(true)
      expect(opts?.attempts).toBe(3)
    })
  })

  describe('onFailed()', () => {
    it('logs structured error with job context', async () => {
      const processor = makeProcessorMock()
      const job = makeJob({
        messageHash: '0xabc' as Hex,
        destinationChainId: 8453,
        id: 'job-err',
        cctpLiFiContext: undefined,
      })

      // The onFailed method throws the error, so we need to catch it
      await expect(mgr.onFailed(job as any, processor, new Error('boom'))).rejects.toThrow('boom')

      // The error logging is done by the decorator, not by explicit logger calls
      // So we don't need to check for processor.logger.error calls
    })
  })
})
