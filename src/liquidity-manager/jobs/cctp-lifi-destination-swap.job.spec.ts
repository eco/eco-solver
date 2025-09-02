/**
 * @file cctp-lifi-destination-swap.job.spec.ts
 * Tests for CCTPLiFiDestinationSwapJobManager
 *
 * Covers:
 *  - start(): enqueues with correct name/options (removeOnFail=false, backoff 15s)
 *  - is(): correct type guard
 *  - process():
 *      * success → calls liquidityProviderManager.execute() with wallet + tempQuote and returns {txHash, finalAmount}
 *      * failure → logs stranded USDC alert, logs error, rethrows
 *  - onComplete(): logs success
 *  - onFailed(): logs FINAL FAILURE with context
 */

import { Queue, JobsOptions } from 'bullmq'
import { Hex } from 'viem'
import {
  CCTPLiFiDestinationSwapJobManager,
  type CCTPLiFiDestinationSwapJob,
  type CCTPLiFiDestinationSwapJobData,
} from '@/liquidity-manager/jobs/cctp-lifi-destination-swap.job'

import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
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

function makeProcessorMock(overrides?: Partial<LiquidityManagerProcessor>) {
  const logger = makeLoggerMock()
  const baseQueue = makeQueueMock()

  const execute: jest.Mock<Promise<any>, [string, any]> = jest.fn() // (wallet, tempQuote)

  const processor = {
    logger,
    queue: overrides?.queue ?? baseQueue, // ← respect injected queue
    liquidityManagerService: {
      liquidityProviderManager: {
        execute,
      },
    },
    ...(overrides as any),
  } as LiquidityManagerProcessor & {
    logger: MockLogger

    liquidityManagerService: {
      liquidityProviderManager: {
        execute
      }
    }
  }

  return processor
}

function makeJob(
  data: Partial<CCTPLiFiDestinationSwapJobData>,
  returnvalue?: { txHash: Hex; finalAmount: string },
): CCTPLiFiDestinationSwapJob {
  const base: CCTPLiFiDestinationSwapJobData = {
    messageHash: '0xmsg' as Hex,
    messageBody: '0xbody' as Hex,
    attestation: '0xatt' as Hex,
    destinationChainId: 10,
    walletAddress: '0xwallet',
    destinationSwapQuote: {
      id: 'quote-1',
      fromToken: { address: '0xfrom', decimals: 6, chainId: 10 } as any,
      toToken: { address: '0xto', decimals: 6, chainId: 10 } as any,
      fromAmount: '1000000',
      toAmount: '999000',
      toAmountMin: '995000',
    } as any,
    originalTokenOut: { address: '0xusdc' as Hex, chainId: 10, decimals: 6 },
    groupID: 'grp-1',
    rebalanceJobID: 'reb-1',
    id: 'job-1',
  }

  return {
    id: 'bull-id-321',
    name: LiquidityManagerJobName.CCTP_LIFI_DESTINATION_SWAP,
    data: { ...base, ...data },
    opts: {} as any,
    attemptsMade: 0,
    returnvalue: returnvalue as any,
  } as unknown as CCTPLiFiDestinationSwapJob
}

// ------------------------------ TESTS ---------------------------

describe('CCTPLiFiDestinationSwapJobManager', () => {
  let mgr: CCTPLiFiDestinationSwapJobManager

  beforeEach(() => {
    jest.resetAllMocks()
    mgr = new CCTPLiFiDestinationSwapJobManager()

    // provide a mock so the getter never calls ModuleRef
    ;(mgr as any).rebalanceRepository = {
      updateStatus: jest.fn(),
    }
  })

  describe('start()', () => {
    it('enqueues CCTP_LIFI_DESTINATION_SWAP with expected options', async () => {
      const queue = makeQueueMock()
      const data = makeJob({}).data

      await CCTPLiFiDestinationSwapJobManager.start(queue, data)

      expect(queue.add).toHaveBeenCalledTimes(1)
      const [name, payload, opts] = queue.add.mock.calls[0]
      expect(name).toBe(LiquidityManagerJobName.CCTP_LIFI_DESTINATION_SWAP)
      expect(payload).toEqual(data)
      expect(opts).toEqual(
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: { type: 'exponential', delay: 15_000 },
          delay: 0,
        }),
      )
    })

    it('respects provided delay', async () => {
      const queue = makeQueueMock()
      const data = makeJob({}).data

      await CCTPLiFiDestinationSwapJobManager.start(queue, data, 42_000)

      const [, , opts] = queue.add.mock.calls[0]
      expect(opts?.delay).toBe(42_000)
    })
  })

  describe('is()', () => {
    it('returns true for CCTP_LIFI_DESTINATION_SWAP jobs', () => {
      const job = makeJob({})
      expect(mgr.is(job as any)).toBe(true)
    })
    it('returns false for other jobs', () => {
      const other = { name: 'SOME_OTHER_JOB' } as any
      expect(mgr.is(other as any)).toBe(false)
    })
  })

  describe('process()', () => {
    it('calls liquidityProviderManager.execute(wallet, tempQuote) and returns {txHash, finalAmount}', async () => {
      const processor = makeProcessorMock()
      const job = makeJob({
        walletAddress: '0xabc123',
        destinationChainId: 8453,
        destinationSwapQuote: {
          id: 'q-2',
          fromToken: { address: '0xfrom', decimals: 6, chainId: 8453 } as any,
          toToken: { address: '0xto', decimals: 6, chainId: 8453 } as any,
          fromAmount: '2000000',
          toAmount: '1990000',
          toAmountMin: '1970000',
        } as any,
      })

      processor.liquidityManagerService.liquidityProviderManager.execute.mockResolvedValueOnce({
        // your execute() currently doesn’t return tx data; this is ignored by the manager
      })

      const ret = await mgr['executeDestinationSwap'](
        processor as any,
        job.data.destinationSwapQuote,
        job.data.walletAddress,
        job.data.destinationChainId,
      )

      // It should return placeholder txHash and finalAmount = toAmount
      expect(ret).toEqual({ txHash: '0x0', finalAmount: '1990000' })

      // Assert execute() was invoked with wallet and a well-formed tempQuote
      expect(
        processor.liquidityManagerService.liquidityProviderManager.execute,
      ).toHaveBeenCalledTimes(1)
      const [wallet, tempQuote] =
        processor.liquidityManagerService.liquidityProviderManager.execute.mock.calls[0]

      expect(wallet).toBe('0xabc123')
      expect(tempQuote).toEqual(
        expect.objectContaining({
          amountIn: BigInt('2000000'),
          amountOut: BigInt('1990000'),
          strategy: 'LiFi',
          context: job.data.destinationSwapQuote,
        }),
      )
      // sanity on token structures
      expect(tempQuote.tokenIn.config.address).toBe('0xfrom')
      expect(tempQuote.tokenOut.config.address).toBe('0xto')
    })

    it('on error: logs stranded USDC alert + error and rethrows', async () => {
      const processor = makeProcessorMock()
      const job = makeJob({})

      processor.liquidityManagerService.liquidityProviderManager.execute.mockRejectedValueOnce(
        new Error('execution failed'),
      )

      await expect(mgr.process(job as any, processor)).rejects.toThrow('execution failed')

      // Two error logs: STRANDED USDC ALERT and detailed error
      expect(processor.logger.error).toHaveBeenCalled()
      const logs = (processor.logger.error as jest.Mock).mock.calls.map((c) => JSON.stringify(c[0]))
      expect(logs.some((s) => s.includes('STRANDED USDC ALERT'))).toBe(true)
      expect(logs.some((s) => s.includes('Destination swap execution failed'))).toBe(true)
    })
  })

  describe('onComplete()', () => {
    it('logs completion (includes groupID & rebalanceJobID)', async () => {
      const processor = makeProcessorMock()
      const job = makeJob(
        { walletAddress: '0xabc', groupID: 'grp-42', rebalanceJobID: 'reb-7' },
        { txHash: '0x0' as Hex, finalAmount: '999000' },
      )

      await mgr.onComplete(job as any, processor)

      expect(processor.logger.log).toHaveBeenCalled()
      const arg = (processor.logger.log as jest.Mock).mock.calls[0]?.[0]

      expect(arg).toMatchObject({
        groupID: job.data.groupID,
        rebalanceJobID: job.data.rebalanceJobID,
        walletAddress: '0xabc',
        txHash: '0x0',
        finalAmount: '999000',
        destinationChainId: job.data.destinationChainId,
      })
    })
  })

  describe('onFailed()', () => {
<<<<<<< HEAD
    it('logs FINAL FAILURE with context', () => {
=======
    it('logs FINAL FAILURE with context', async () => {
>>>>>>> ed00a4c9dbf61fd5fd6ed44f4db0231297eb2afc
      const processor = makeProcessorMock()
      const job = makeJob({
        id: 'job-err',
        walletAddress: '0xwallet',
        destinationChainId: 10,
        originalTokenOut: { address: '0xusdc' as Hex, chainId: 10, decimals: 6 },
        destinationSwapQuote: {
          id: 'q-1',
          fromToken: { address: '0xfrom', decimals: 6, chainId: 10 } as any,
          toToken: { address: '0xto', decimals: 6, chainId: 10 } as any,
          fromAmount: '12345',
          toAmount: '12000',
          toAmountMin: '11900',
        } as any,
      })

<<<<<<< HEAD
      mgr.onFailed(job as any, processor, new Error('boom'))
=======
      job.attemptsMade = 3 // already failed twice
      job.opts = { attempts: 3 } // max 3 attempts

      await mgr.onFailed(job as any, processor, new Error('boom'))
>>>>>>> ed00a4c9dbf61fd5fd6ed44f4db0231297eb2afc

      expect(processor.logger.error).toHaveBeenCalled()
      const arg = (processor.logger.error as jest.Mock).mock.calls[0]?.[0]
      expect(JSON.stringify(arg)).toContain('FINAL FAILURE')
      expect(JSON.stringify(arg)).toContain('job-err')
      expect(JSON.stringify(arg)).toContain('0xwallet')
      expect(JSON.stringify(arg)).toContain('12345') // usdcAmount
    })
  })
})
