import { GenericContainer, StartedTestContainer } from 'testcontainers'
import { LiquidityManagerJobName, LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { Queue, Worker, Job } from 'bullmq'
import { RebalanceJobManager, RebalanceJobData } from '@/liquidity-manager/jobs/rebalance.job'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { serialize } from '@/common/utils/serialize'
import IORedis from 'ioredis'

describe('E2E: Rebalance onComplete updates DB status', () => {
  jest.setTimeout(60000)

  let container: StartedTestContainer
  let queueConn: IORedis
  let workerConn: IORedis
  let queue: Queue
  let worker: Worker

  // repository mock exposed for assertions
  let repoMock: { updateStatus: jest.Mock }

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start()

    const host = container.getHost()
    const port = container.getMappedPort(6379)

    const redisOpts = {
      host,
      port,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
    }

    queueConn = new IORedis(redisOpts)
    workerConn = new IORedis(redisOpts)

    queue = new Queue(LiquidityManagerQueue.flowName, { connection: queueConn })

    const logger = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }

    worker = new Worker(
      queue.name,
      async (job: Job) => {
        if (job.name !== LiquidityManagerJobName.REBALANCE) {
          throw new Error(`Unexpected job name: ${job.name}`)
        }

        const mgr = new RebalanceJobManager()

        // patch repo with jest mock
        repoMock = {
          updateStatus: jest.fn().mockResolvedValue(null),
        } as any
        ;(mgr as any).rebalanceRepository = repoMock

        const processor = {
          logger,
          liquidityManagerService: {
            executeRebalancing: jest.fn().mockResolvedValue(undefined),
          },
          queue,
        } as any

        const ret = await mgr.process(job as any, processor)
        ;(job as any).returnvalue = ret
        await mgr.onComplete(job as any, processor)
        return ret
      },
      { connection: workerConn, concurrency: 1 },
    )

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

    await worker.waitUntilReady()
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

  it('marks associated Rebalance records as COMPLETED', async () => {
    const rebalanceRequest = {
      token: {} as any,
      quotes: [{ rebalanceJobID: 'reb-1' }, { rebalanceJobID: 'reb-2' }] as any,
    }

    const data: RebalanceJobData = {
      network: '10',
      walletAddress: '0xwallet',
      rebalance: serialize(rebalanceRequest as any) as any,
    }

    const done = new Promise<void>((resolve, reject) => {
      const handler = (job: Job) => {
        if (job.name === LiquidityManagerJobName.REBALANCE) {
          worker.off('completed', handler)
          resolve()
        }
      }
      worker.on('completed', handler)
      worker.on('failed', (_job, err) => reject(err))
    })

    await queue.add(LiquidityManagerJobName.REBALANCE, data, {
      removeOnComplete: true,
      removeOnFail: true,
    })

    await done

    expect(repoMock.updateStatus).toHaveBeenCalledTimes(2)
    expect(repoMock.updateStatus).toHaveBeenNthCalledWith(1, 'reb-1', RebalanceStatus.COMPLETED)
    expect(repoMock.updateStatus).toHaveBeenNthCalledWith(2, 'reb-2', RebalanceStatus.COMPLETED)
  })
})
