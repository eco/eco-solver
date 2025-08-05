import { createMock } from '@golevelup/ts-jest'
import { EcoCronJobManager } from '@/liquidity-manager/jobs/eco-cron-job-manager'
import { GenericContainer } from 'testcontainers'
import { jest } from '@jest/globals'
import { Job, Queue } from 'bullmq'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'

describe('EcoCronJobManager', () => {
  let mockQueue: Queue
  let ecoCronJobManager: EcoCronJobManager
  const jobName = LiquidityManagerJobName.CHECK_BALANCES
  const walletAddress = '0xabc123'
  const jobIDPrefix = `check-balances-${walletAddress}`

  beforeEach(() => {
    mockQueue = createMock<Queue>()

    // Override the readonly `.name` property
    Object.defineProperty(mockQueue, 'name', {
      value: 'mock-queue',
      writable: false, // this mirrors the readonly type
      configurable: true, // allows redefinition in tests
    })

    ecoCronJobManager = new EcoCronJobManager(jobName, jobIDPrefix)
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.restoreAllMocks()
  })

  it('should start and schedule checkAndEmitDeduped loop', async () => {
    const addMock = jest.spyOn(mockQueue, 'add').mockResolvedValue({ id: 'mock-job-id' } as Job)

    await ecoCronJobManager.start(mockQueue, 50, walletAddress) // shorter interval for test

    await new Promise((resolve) => setTimeout(resolve, 100)) // let loop tick at least once
    ecoCronJobManager.stop()

    expect(addMock).toHaveBeenCalledWith(
      jobName,
      { wallet: walletAddress },
      expect.objectContaining({
        jobId: expect.stringContaining(walletAddress),
        removeOnComplete: true,
        removeOnFail: true,
      }),
    )
  })

  it('should skip start() if already started', async () => {
    const spy = jest.spyOn(mockQueue, 'add')
    ecoCronJobManager['started'] = true

    await ecoCronJobManager.start(mockQueue, 5000, walletAddress)

    expect(spy).not.toHaveBeenCalled()
  })

  it('should stop the loop with stop()', async () => {
    ecoCronJobManager['started'] = true
    ecoCronJobManager['stopRequested'] = false

    ecoCronJobManager.stop()

    expect(ecoCronJobManager['stopRequested']).toBe(true)
  })

  it('checkAndEmitDeduped should add job with correct parameters', async () => {
    const redisContainer = await new GenericContainer('redis').withExposedPorts(6379).start()

    const queue = new Queue('test-queue', {
      connection: {
        host: redisContainer.getHost(),
        port: redisContainer.getMappedPort(6379),
      },
    })

    const { response: job, error } = await ecoCronJobManager['checkAndEmitDeduped'](
      queue,
      walletAddress,
      ecoCronJobManager['createJobTemplate'](walletAddress),
    )

    expect(error).toBeUndefined()
    expect(job).toBeDefined()

    expect(job).toEqual(
      expect.objectContaining({
        name: jobName,
        id: ecoCronJobManager['jobIDPrefix'],
      }),
    )

    await queue.close()
    await redisContainer.stop()
  })

  it('checkAndEmitDeduped should handle errors gracefully', async () => {
    const error = new Error('add failed')
    jest.spyOn(mockQueue, 'add').mockRejectedValue(error)

    const result = await ecoCronJobManager['checkAndEmitDeduped'](
      mockQueue,
      walletAddress,
      ecoCronJobManager['createJobTemplate'](walletAddress),
    )

    expect(result.error).toBe(error)
    expect(result.response).toBeUndefined()
  })

  it('createJobTemplate should return expected structure', () => {
    const jobTemplate = ecoCronJobManager['createJobTemplate'](walletAddress)
    expect(jobTemplate).toEqual({
      name: jobName,
      data: { wallet: walletAddress },
      opts: expect.objectContaining({ removeOnComplete: true, removeOnFail: true }),
    })
  })

  it('should not enqueue duplicate jobs due to BullMQ deduplication', async () => {
    const jobTemplate = ecoCronJobManager['createJobTemplate'](walletAddress)

    // First call returns a fake job (normal flow)
    const addSpy = jest.spyOn(mockQueue, 'add').mockResolvedValueOnce({
      id: `${ecoCronJobManager['jobIDPrefix']}-${walletAddress}`,
    } as unknown as Job)

    // Second call simulates BullMQ rejecting due to deduplication
    addSpy.mockRejectedValueOnce(new Error('Job already exists'))

    // First call - job is added
    const result1 = await ecoCronJobManager['checkAndEmitDeduped'](mockQueue, walletAddress, jobTemplate)
    expect(result1.response).toBeDefined()
    expect(result1.error).toBeUndefined()

    // Second call - deduped
    const result2 = await ecoCronJobManager['checkAndEmitDeduped'](mockQueue, walletAddress, jobTemplate)
    expect(result2.response).toBeUndefined()
    expect(result2.error?.message).toMatch(/already exists/i)

    expect(addSpy).toHaveBeenCalledTimes(2)
  })

  it('should not add duplicate jobs when jobId matches an active one', async () => {
    const redisContainer = await new GenericContainer('redis').withExposedPorts(6379).start()

    const queue = new Queue('test-queue', {
      connection: {
        host: redisContainer.getHost(),
        port: redisContainer.getMappedPort(6379),
      },
    })

    const cron = new EcoCronJobManager('TEST_JOB', 'test-id')

    const walletAddress = '0xabc'
    const jobTemplate = {
      name: 'TEST_JOB',
      data: { wallet: walletAddress },
      opts: {
        jobId: `test-id-${walletAddress}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    }

    // Add the job the first time
    const job1 = await queue.add(jobTemplate.name, jobTemplate.data, jobTemplate.opts)
    expect(job1.id).toBe(`test-id-${walletAddress}`)

    // Try to add the same job again – BullMQ will silently return existing job or throw, depending on config
    const job2 = await queue.add(jobTemplate.name, jobTemplate.data, jobTemplate.opts)
    expect(job2.id).toBe(job1.id)

    const jobs = await queue.getJobs(['waiting', 'active', 'delayed'])
    expect(jobs).toHaveLength(1) // Only one job added

    await queue.close()
    await redisContainer.stop()
  })
})
