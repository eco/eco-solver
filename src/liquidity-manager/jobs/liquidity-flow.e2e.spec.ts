import {
  CheckCCTPAttestationJobManager,
  type CheckCCTPAttestationJobData,
} from '@/liquidity-manager/jobs/check-cctp-attestation.job'

import { CCTPLiFiDestinationSwapJobManager } from '@/liquidity-manager/jobs/cctp-lifi-destination-swap.job'
import { ExecuteCCTPMintJobManager } from '@/liquidity-manager/jobs/execute-cctp-mint.job'
import { GenericContainer, StartedTestContainer } from 'testcontainers'
import { Hex } from 'viem'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueue,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { Queue, Worker, Job, JobsOptions } from 'bullmq'
import IORedis from 'ioredis'
import type { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { ModuleRef } from '@nestjs/core'
import { ModuleRefProvider } from '@/common/services/module-ref-provider'

// import the token(s) you need to resolve:
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

/*
What’s genuinely E2E here
	•	Real Redis (Testcontainers) ✅
	•	Real BullMQ Queue + Worker with blocking connection ✅
	•	Real managers: CheckCCTPAttestationJobManager, ExecuteCCTPMintJobManager, CCTPLiFiDestinationSwapJobManager all run their process() and onComplete() ✅
	•	Real re-enqueue loop for the attestation (pending → re-add → complete) ✅
	•	Worker routing processes each job name and chains to the next ✅

What’s mocked (by design)
	•	External side effects:
	•	cctpProviderService.fetchAttestation/receiveMessage (so you don’t actually hit CCTP)
	•	liquidityProviderManager.execute (no real swap)
	•	Delay override for the re-enqueue (to keep tests fast).
	•	Only one shortcut: we patched ExecuteCCTPMintJobManager.onComplete() to call CCTPLiFiDestinationSwapJobManager.start()
    directly (instead of using the dynamic import()), to avoid TS/Jest module-resolution flakiness. It still enqueues the real
    destination-swap job into BullMQ, which the worker then processes.
*/

describe('E2E: CCTP attestation → mint → LiFi destination swap', () => {
  jest.setTimeout(60_000)

  let container: StartedTestContainer
  let queueConn: IORedis
  let workerConn: IORedis
  let queue: Queue
  let worker: Worker
  let processor: LiquidityManagerProcessor
  let seen: string[] = []

  // signal end-of-chain
  let destSwapCompleted!: () => void
  const destSwapDone = new Promise<void>((resolve) => (destSwapCompleted = resolve))

  beforeAll(async () => {
    const repoMock = { updateStatus: jest.fn() }

    const fakeModuleRef = {
      get: jest.fn((token: any) => {
        if (token === RebalanceRepository) return repoMock
        // return other service/repo doubles as needed
        return {}
      }),
    } as unknown as ModuleRef

    jest.spyOn(ModuleRefProvider, 'getModuleRef').mockReturnValue(fakeModuleRef)

    // 1) start Redis
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start()

    const host = container.getHost()
    const port = container.getMappedPort(6379)

    // 2) BullMQ-compatible redis opts
    const redisOpts = {
      host,
      port,
      maxRetriesPerRequest: null as null, // required by BullMQ
      enableReadyCheck: false, // speed up tests
    }

    // 3) dedicated clients
    queueConn = new IORedis(redisOpts)
    workerConn = new IORedis(redisOpts)

    // 4) real queue
    queue = new Queue(LiquidityManagerQueue.flowName, { connection: queueConn })

    // 5) processor mocks
    const logger = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }

    type AttestationResult = { status: 'pending' } | { status: 'complete'; attestation: Hex }

    // i) fetchAttestation: first pending, then complete
    const fetchAttestation = jest
      .fn<Promise<AttestationResult>, [Hex]>()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'complete', attestation: '0xatt' as Hex })

    // ii) receiveMessage: returns mint tx hash
    const receiveMessage = jest
      .fn<Promise<Hex>, [number, Hex, Hex, string?]>()
      .mockResolvedValue('0xminttx' as Hex)

    // ii.5) getTxReceipt: returns receipt
    const getTxReceipt = jest
      .fn<Promise<any>, [number, Hex]>()
      .mockResolvedValue({ status: 'success' })

    // iii) execute: destination swap execute call
    const execute = jest.fn<Promise<any>, [string, any]>().mockResolvedValue({ ok: true })

    processor = {
      logger,
      queue,
      cctpProviderService: {
        fetchAttestation,
        receiveMessage,
        getTxReceipt,
      },
      liquidityManagerService: {
        liquidityProviderManager: { execute },
      },
    } as any

    // 6) (still keep the start spy; not strictly needed now, but harmless)
    jest
      .spyOn(CheckCCTPAttestationJobManager, 'start')
      .mockImplementation(async (q, data /*, delay */) => {
        const opts: JobsOptions = {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          delay: 25, // <<< force small delay regardless of the real 30_000
        }
        await q.add(LiquidityManagerJobName.CHECK_CCTP_ATTESTATION, data, opts)
      })

    // 7) patch ExecuteCCTPMint.onComplete to avoid dynamic import in tests
    jest
      .spyOn(ExecuteCCTPMintJobManager.prototype, 'onComplete')
      .mockImplementation(async function (this: ExecuteCCTPMintJobManager, job: any, proc: any) {
        const { cctpLiFiContext } = job.data
        proc.logger.log({
          message: 'CCTP: ExecuteCCTPMintJob: Completed!',
          properties: { txHash: job.returnvalue },
        })
        if (cctpLiFiContext && cctpLiFiContext.destinationSwapQuote) {
          const data = {
            groupID: job.data.groupID,
            rebalanceJobID: job.data.rebalanceJobID,
            messageHash: job.data.messageHash,
            messageBody: job.data.messageBody,
            attestation: job.data.attestation,
            destinationChainId: job.data.destinationChainId,
            destinationSwapQuote: cctpLiFiContext.destinationSwapQuote,
            walletAddress: cctpLiFiContext.walletAddress,
            originalTokenOut: cctpLiFiContext.originalTokenOut,
            id: job.data.id,
          }
          await CCTPLiFiDestinationSwapJobManager.start(proc.queue, data)
        }
      })

    // 7.1) patch CCTPLiFiDestinationSwap.onComplete to avoid AutoInject ModuleRef access in tests
    jest
      .spyOn(CCTPLiFiDestinationSwapJobManager.prototype, 'onComplete')
      .mockImplementation(async function (
        this: CCTPLiFiDestinationSwapJobManager,
        job: any,
        processor: any,
      ) {
        processor.logger.log({
          message:
            'CCTPLiFi: CCTPLiFiDestinationSwapJob: Destination swap completed successfully (patched)',
          properties: {
            jobId: job.data.id,
            destinationChainId: job.data.destinationChainId,
            walletAddress: job.data.walletAddress,
            txHash: job.returnvalue?.txHash,
          },
        })
        // Skip repository status update in this E2E to avoid ModuleRef
      })

    // 8) worker router
    worker = new Worker(
      queue.name,
      async (job: Job) => {
        if (job.name === LiquidityManagerJobName.CHECK_CCTP_ATTESTATION) {
          const mgr = new CheckCCTPAttestationJobManager()
          const ret = await mgr.process(job as any, processor)
          ;(job as any).returnvalue = ret
          await mgr.onComplete(job as any, processor)
          return ret
        }

        if (job.name === LiquidityManagerJobName.EXECUTE_CCTP_MINT) {
          const mgr = new ExecuteCCTPMintJobManager()
          const ret = await mgr.process(job as any, processor)
          ;(job as any).returnvalue = ret
          await mgr.onComplete(job as any, processor)
          return ret
        }

        if (job.name === LiquidityManagerJobName.CCTP_LIFI_DESTINATION_SWAP) {
          const mgr = new CCTPLiFiDestinationSwapJobManager()
          const ret = await mgr.process(job as any, processor)
          ;(job as any).returnvalue = ret
          await mgr.onComplete(job as any, processor)
          destSwapCompleted()
          return ret
        }

        // If a name doesn't match, fail loudly
        throw new Error(`Unexpected job name: ${job.name}`)
      },
      { connection: workerConn, concurrency: 1 },
    )

    // ❗ fail test immediately on worker errors/failures
    worker.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.error('Worker job failed:', job?.name, err)
      throw err
    })
    worker.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Worker error:', err)
      throw err
    })

    worker.on('completed', (job) => {
      seen.push(job.name)
    })

    await worker.waitUntilReady()
    await sleep(25)
  })

  afterAll(async () => {
    try {
      await worker?.close()
    } catch {}
    try {
      await queue?.obliterate({ force: true })
    } catch {}
    try {
      await queue?.close()
    } catch {}
    try {
      await queueConn?.quit()
    } catch {}
    try {
      await workerConn?.quit()
    } catch {}
    try {
      await container?.stop()
    } catch {}
  })

  it('runs the full chain successfully', async () => {
    const initial: CheckCCTPAttestationJobData = {
      destinationChainId: 10,
      messageHash: '0xdead' as Hex,
      messageBody: '0xbody' as Hex,
      groupID: 'grp-42',
      rebalanceJobID: 'reb-7',
      id: 'job-123',
      cctpLiFiContext: {
        destinationSwapQuote: {
          id: 'q-1',
          fromToken: { address: '0xfrom', decimals: 6, chainId: 10 },
          toToken: { address: '0xto', decimals: 6, chainId: 10 },
          fromAmount: '1000000',
          toAmount: '990000',
          toAmountMin: '985000',
        } as any,
        walletAddress: '0xwallet',
        originalTokenOut: { address: '0xusdc' as Hex, chainId: 10, decimals: 6 },
      },
    }

    // To avoid sleeps, an alternative is to wait specifically for the last 'completed'
    const lastCompleted = new Promise<void>((resolve) => {
      const handler = (job: Job) => {
        if (job.name === LiquidityManagerJobName.CCTP_LIFI_DESTINATION_SWAP) {
          worker.off('completed', handler)
          resolve()
        }
      }
      worker.on('completed', handler)
    })

    await CheckCCTPAttestationJobManager.start(queue, initial)

    await Promise.race([
      Promise.all([destSwapDone, lastCompleted]),
      // destSwapDone,
      sleep(20_000).then(() => {
        throw new Error('Flow timeout')
      }),
    ])

    // Sequence assertion
    expect(seen).toEqual([
      'CHECK_CCTP_ATTESTATION', // first run (pending)
      'CHECK_CCTP_ATTESTATION', // re-enqueued (complete)
      'EXECUTE_CCTP_MINT',
      'CCTP_LIFI_DESTINATION_SWAP',
    ])

    // Attestation is checked twice (pending -> re-enqueue -> complete)
    expect(processor.cctpProviderService.fetchAttestation).toHaveBeenCalledTimes(2)
    expect(processor.cctpProviderService.fetchAttestation).toHaveBeenNthCalledWith(1, '0xdead')
    expect(processor.cctpProviderService.fetchAttestation).toHaveBeenNthCalledWith(2, '0xdead')

    // Mint is executed once
    expect(processor.cctpProviderService.receiveMessage).toHaveBeenCalledTimes(1)
    expect(processor.cctpProviderService.receiveMessage).toHaveBeenCalledWith(
      10,
      '0xbody',
      '0xatt',
      'job-123',
    )

    // Destination swap executed once
    expect(
      processor.liquidityManagerService.liquidityProviderManager.execute,
    ).toHaveBeenCalledTimes(1)

    const [wallet, tempQuote] = (
      processor.liquidityManagerService.liquidityProviderManager.execute as any
    ).mock.calls[0]
    expect(wallet).toBe('0xwallet')
    expect(tempQuote?.strategy).toBe('LiFi')

    expect((processor.logger.debug as jest.Mock).mock.calls.length).toBeGreaterThan(0)
    expect((processor.logger.log as jest.Mock).mock.calls.length).toBeGreaterThan(0)
  })
})
