/**
 * @file execute-cctp-mint.job.spec.ts
 * Tests for ExecuteCCTPMintJobManager
 *
 * Covers:
 *  - start(): enqueues with correct name/options (jobId includes messageHash)
 *  - is(): correct type guard
 *  - process(): calls provider.receiveMessage and returns tx hash
 *  - onComplete():
 *      * logs success
 *      * if cctpLiFiContext present → dynamically imports and enqueues destination swap
 *  - onFailed(): structured error logging
 */

import { Queue, JobsOptions } from 'bullmq'
import { Hex } from 'viem'
import {
  ExecuteCCTPMintJobManager,
  type ExecuteCCTPMintJob,
  type ExecuteCCTPMintJobData,
} from '@/liquidity-manager/jobs/execute-cctp-mint.job'

import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { ModuleRefProvider } from '@/common/services/module-ref-provider'
import { ModuleRef } from '@nestjs/core'

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

function makeProcessorMock(overrides?: Partial<LiquidityManagerProcessor>) {
  const logger = makeLoggerMock()
  const baseQueue = makeQueueMock()

  const receiveMessage: jest.Mock<Promise<Hex>, [number, Hex, Hex, string?]> = jest.fn()
  const getTxReceipt: jest.Mock<Promise<any>, [number, Hex]> = jest.fn()

  return {
    logger,
    queue: overrides?.queue ?? baseQueue, // ← respect injected queue
    cctpProviderService: {
      receiveMessage,
      getTxReceipt,
    },
    ...(overrides as any),
  } as unknown as LiquidityManagerProcessor & {
    logger: MockLogger

    cctpProviderService: {
      receiveMessage
      getTxReceipt
    }
  }
}

function makeJob(data: Partial<ExecuteCCTPMintJobData>, returnvalue?: Hex): ExecuteCCTPMintJob {
  const base: ExecuteCCTPMintJobData = {
    destinationChainId: 8453,
    messageHash: '0xabc' as Hex,
    messageBody: '0xdeadbeef' as Hex,
    attestation: '0xbeef' as Hex,
    groupID: 'grp-1',
    rebalanceJobID: 'reb-1',
    id: 'job-1',
  }
  return {
    id: 'bull-id-999',
    name: LiquidityManagerJobName.EXECUTE_CCTP_MINT,
    data: { ...base, ...data },
    opts: {} as any,
    attemptsMade: 0,
    returnvalue: returnvalue as any,
    updateData: jest.fn(),
  } as unknown as ExecuteCCTPMintJob
}

// --- Mock the dynamically imported destination-swap manager ---
// NOTE: Adjust this module path if your repo path differs.
jest.mock('@/liquidity-manager/jobs/cctp-lifi-destination-swap.job', () => {
  return {
    CCTPLiFiDestinationSwapJobManager: {
      start: jest.fn(async () => {}),
    },
  }
})
// handy handle
const { CCTPLiFiDestinationSwapJobManager } = jest.requireMock(
  '@/liquidity-manager/jobs/cctp-lifi-destination-swap.job',
) as {
  CCTPLiFiDestinationSwapJobManager: { start: jest.Mock }
}

// ------------------------------ TESTS ---------------------------

describe('ExecuteCCTPMintJobManager', () => {
  let mgr: ExecuteCCTPMintJobManager
  let repoMock: { updateStatus: jest.Mock }

  beforeAll(() => {})

  beforeEach(() => {
    jest.resetAllMocks()
    mgr = new ExecuteCCTPMintJobManager()

    // provide a mock so the getter never calls ModuleRef
    ;(mgr as any).rebalanceRepository = {
      updateStatus: jest.fn(),
    }
  })

  describe('start()', () => {
    it('enqueues EXECUTE_CCTP_MINT with jobId including messageHash and expected options', async () => {
      const queue = makeQueueMock()
      const data = makeJob({ messageHash: '0xdead' as Hex }).data

      await ExecuteCCTPMintJobManager.start(queue, data)

      expect(queue.add).toHaveBeenCalledTimes(1)
      const [name, payload, opts] = queue.add.mock.calls[0]
      expect(name).toBe(LiquidityManagerJobName.EXECUTE_CCTP_MINT)
      expect(payload).toEqual(data)
      expect(opts).toEqual(
        expect.objectContaining({
          jobId: `${ExecuteCCTPMintJobManager.name}-${data.messageHash}`,
          removeOnFail: false,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
        }),
      )
    })
  })

  describe('is()', () => {
    it('returns true for EXECUTE_CCTP_MINT jobs', () => {
      const job = makeJob({})
      expect(mgr.is(job as any)).toBe(true)
    })
    it('returns false for other jobs', () => {
      const other = { name: 'SOME_OTHER_JOB' } as any
      expect(mgr.is(other)).toBe(false)
    })
  })

  describe('process()', () => {
    it('calls cctpProviderService.receiveMessage(chainId, body, attestation) and returns tx hash', async () => {
      const processor = makeProcessorMock()

      const job = makeJob({
        destinationChainId: 10,
        messageBody: '0xaaaa' as Hex,
        attestation: '0xbbbb' as Hex,
      })

      const tx: Hex = '0xfeed' as Hex
      processor.cctpProviderService.receiveMessage.mockResolvedValueOnce(tx)

      const ret = await mgr.process(job as any, processor)

      expect(processor.cctpProviderService.receiveMessage).toHaveBeenCalledWith(
        10,
        '0xaaaa',
        '0xbbbb',
        job.data.id,
      )
      expect(job.updateData).toHaveBeenCalledWith({ ...job.data, txHash: tx })
      expect(ret).toBe(tx)
    })

    it('reuses existing txHash if already set', async () => {
      const processor = makeProcessorMock()

      const existingTxHash = '0xexisting' as Hex
      const job = makeJob({
        destinationChainId: 10,
        messageBody: '0xaaaa' as Hex,
        attestation: '0xbbbb' as Hex,
        txHash: existingTxHash,
      })

      // Add getTxReceipt mock
      processor.cctpProviderService.getTxReceipt = jest
        .fn()
        .mockResolvedValue({ status: 'success' })

      const ret = await mgr.process(job as any, processor)

      // Should not call receiveMessage if txHash already exists
      expect(processor.cctpProviderService.receiveMessage).not.toHaveBeenCalled()
      // Should call getTxReceipt with existing txHash
      expect(processor.cctpProviderService.getTxReceipt).toHaveBeenCalledWith(10, existingTxHash)
      // Should not call updateData since txHash is already set
      expect(job.updateData).not.toHaveBeenCalled()
      expect(ret).toBe(existingTxHash)
    })
  })

  describe('onComplete()', () => {
    it('logs completion (without LiFi context)', async () => {
      const processor = makeProcessorMock()
      const job = makeJob(
        {
          destinationChainId: 10,
          messageHash: '0xdead' as Hex,
          id: 'job-xyz',
          // no cctpLiFiContext
        },
        '0xminttx' as Hex,
      )

      await mgr.onComplete(job as any, processor)

      expect(processor.logger.log).toHaveBeenCalled()
      // should NOT enqueue destination swap
      expect(CCTPLiFiDestinationSwapJobManager.start).not.toHaveBeenCalled()
    })

    it('when cctpLiFiContext present: dynamically imports and enqueues destination swap', async () => {
      const processor = makeProcessorMock()
      const job = makeJob(
        {
          destinationChainId: 10,
          messageHash: '0xdead' as Hex,
          messageBody: '0xbody' as Hex,
          attestation: '0xatt' as Hex,
          id: 'job-ctx',
          cctpLiFiContext: {
            destinationSwapQuote: {
              id: 'quote-1',
              fromToken: { address: '0xfrom', decimals: 6, chainId: 10 } as any,
              toToken: { address: '0xto', decimals: 6, chainId: 10 } as any,
              fromAmount: '1000000',
              toAmount: '999000',
              toAmountMin: '995000',
            } as any,
            walletAddress: '0xwallet',
            originalTokenOut: { address: '0xusdc' as Hex, chainId: 10, decimals: 6 },
          },
        },
        '0xminttx' as Hex,
      )

      await mgr.onComplete(job as any, processor)

      expect(processor.logger.debug).toHaveBeenCalled()
      expect(CCTPLiFiDestinationSwapJobManager.start).toHaveBeenCalledTimes(1)

      const [qArg, dataArg] = CCTPLiFiDestinationSwapJobManager.start.mock.calls[0]
      expect(qArg).toBe(processor.queue)
      expect(dataArg).toMatchObject({
        groupID: job.data.groupID,
        rebalanceJobID: job.data.rebalanceJobID,
        messageHash: job.data.messageHash,
        messageBody: job.data.messageBody,
        attestation: job.data.attestation,
        destinationChainId: job.data.destinationChainId,
        walletAddress: job.data.cctpLiFiContext!.walletAddress,
        originalTokenOut: job.data.cctpLiFiContext!.originalTokenOut,
        destinationSwapQuote: job.data.cctpLiFiContext!.destinationSwapQuote,
        id: job.data.id,
      })
    })
  })

  describe('onFailed()', () => {
    it('logs structured error', () => {
      const processor = makeProcessorMock()
      const job = makeJob({
        messageHash: '0xabc' as Hex,
        destinationChainId: 8453,
        id: 'job-err',
      })

      mgr.onFailed(job as any, processor, new Error('boom'))

      expect(processor.logger.error).toHaveBeenCalled()
      const arg = (processor.logger.error as jest.Mock).mock.calls[0]?.[0]
      expect(JSON.stringify(arg)).toContain('ExecuteCCTPMintJob: Failed')
      expect(JSON.stringify(arg)).toContain('job-err')
    })
  })
})
