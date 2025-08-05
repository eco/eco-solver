import { createMock } from '@golevelup/ts-jest'
import { EcoCronJobManager } from '@/liquidity-manager/jobs/eco-cron-job-manager'
import { GenericContainer } from 'testcontainers'
import { jest } from '@jest/globals'
import { Job, Queue } from 'bullmq'

jest.useFakeTimers()

describe('EcoCronJobManager', () => {
  let queue: Queue
  let cron: EcoCronJobManager
  const jobName = 'test-job'
  const jobIDPrefix = 'prefix'
  const interval = 5000
  const walletAddress = '0xabc123'

  beforeEach(() => {
    queue = createMock<Queue>()

    // Override the readonly `.name` property
    Object.defineProperty(queue, 'name', {
      value: 'mock-queue',
      writable: false, // this mirrors the readonly type
      configurable: true, // allows redefinition in tests
    })

    cron = new EcoCronJobManager(jobName, jobIDPrefix)
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.restoreAllMocks()
  })

  it('should start and schedule checkAndEmitDeduped loop', async () => {
    const addMock = jest.spyOn(queue, 'add').mockResolvedValue({ id: 'mock-job-id' } as Job)

    // jest.useFakeTimers()
    const immediateSpy = jest.spyOn(global, 'setImmediate')

    await cron.start(queue, interval, walletAddress)

    // Fast-forward timers to trigger the loop once
    jest.runOnlyPendingTimers()
    await Promise.resolve() // allow pending promises to resolve

    expect(immediateSpy).toHaveBeenCalled()
    expect(addMock).toHaveBeenCalledWith(
      jobName, // should match this.jobName in cron
      { wallet: walletAddress },
      expect.objectContaining({
        jobId: expect.stringContaining(walletAddress),
        removeOnComplete: true,
        removeOnFail: true,
      }),
    )

    jest.useRealTimers()
  })

  it('should skip start() if already started', async () => {
    const spy = jest.spyOn(queue, 'add')
    cron['started'] = true

    await cron.start(queue, interval, walletAddress)

    expect(spy).not.toHaveBeenCalled()
  })

  it('should stop the loop with stop()', async () => {
    cron['started'] = true
    cron['stopRequested'] = false

    cron.stop()

    expect(cron['stopRequested']).toBe(true)
  })

  it('checkAndEmitDeduped should add job with correct parameters', async () => {
    const addMock = jest.spyOn(queue, 'add').mockResolvedValue({ id: 'job-123' } as Job)

    const result = await cron['checkAndEmitDeduped'](
      queue,
      walletAddress,
      cron['createJobTemplate'](walletAddress),
    )

    expect(result.response).toBeDefined()
    expect(addMock).toHaveBeenCalledWith(
      jobName,
      { wallet: walletAddress },
      expect.objectContaining({ jobId: `${jobIDPrefix}-${walletAddress}` }),
    )
  })

  it('checkAndEmitDeduped should handle errors gracefully', async () => {
    const error = new Error('add failed')
    jest.spyOn(queue, 'add').mockRejectedValue(error)

    const result = await cron['checkAndEmitDeduped'](
      queue,
      walletAddress,
      cron['createJobTemplate'](walletAddress),
    )

    expect(result.error).toBe(error)
    expect(result.response).toBeUndefined()
  })

  it('createJobTemplate should return expected structure', () => {
    const jobTemplate = cron['createJobTemplate'](walletAddress)
    expect(jobTemplate).toEqual({
      name: jobName,
      data: { wallet: walletAddress },
      opts: expect.objectContaining({ removeOnComplete: true, removeOnFail: true }),
    })
  })

  it('should not enqueue duplicate jobs due to BullMQ deduplication', async () => {
    const jobTemplate = cron['createJobTemplate'](walletAddress)

    // First call returns a fake job (normal flow)
    const addSpy = jest.spyOn(queue, 'add').mockResolvedValueOnce({
      id: `${cron['jobIDPrefix']}-${walletAddress}`,
    } as unknown as Job)

    // Second call simulates BullMQ rejecting due to deduplication
    addSpy.mockRejectedValueOnce(new Error('Job already exists'))

    // First call - job is added
    const result1 = await cron['checkAndEmitDeduped'](queue, walletAddress, jobTemplate)
    expect(result1.response).toBeDefined()
    expect(result1.error).toBeUndefined()

    // Second call - deduped
    const result2 = await cron['checkAndEmitDeduped'](queue, walletAddress, jobTemplate)
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
  })
})
