import { TxSigningQueueService } from '@/liquidity-manager/wallet-wrappers/tx-signing-queue.service'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('TxSigningQueueService', () => {
  it('serializes tasks for the same wallet|chain key (FIFO)', async () => {
    const q = new TxSigningQueueService()
    const wallet = '0xWallet'
    const chainId = 1

    const marks: Record<string, number> = {}

    const p1 = q.enqueue(wallet, chainId, async () => {
      marks['p1-start'] = Date.now()
      await sleep(100)
      marks['p1-end'] = Date.now()
      return 'ok1'
    })

    const p2 = q.enqueue(wallet, chainId, async () => {
      marks['p2-start'] = Date.now()
      await sleep(10)
      marks['p2-end'] = Date.now()
      return 'ok2'
    })

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('ok1')
    expect(r2).toBe('ok2')

    // Ensure p2 did not start until after p1 finished
    expect(marks['p2-start']).toBeGreaterThanOrEqual(marks['p1-end'])
  })

  it('runs tasks concurrently for different keys', async () => {
    const q = new TxSigningQueueService()

    const start = Date.now()
    await Promise.all([
      q.enqueue('0xwallet', 1, async () => sleep(120)),
      q.enqueue('0xwallet', 2, async () => sleep(120)),
    ])
    const elapsed = Date.now() - start

    // If serialized incorrectly, elapsed would be ~240ms; assert significantly less
    expect(elapsed).toBeLessThan(210)
  })

  it('propagates task errors to caller but keeps the chain intact', async () => {
    const q = new TxSigningQueueService()
    const wallet = '0xabc'
    const chainId = 10

    const order: string[] = []

    const p1 = q.enqueue(wallet, chainId, async () => {
      order.push('p1')
      await sleep(10)
      return 'one'
    })

    const p2 = q.enqueue(wallet, chainId, async () => {
      order.push('p2')
      await sleep(10)
      throw new Error('boom')
    })

    const p3 = q.enqueue(wallet, chainId, async () => {
      order.push('p3')
      await sleep(10)
      return 'three'
    })

    await expect(p1).resolves.toBe('one')
    await expect(p2).rejects.toThrow('boom')
    await expect(p3).resolves.toBe('three')

    expect(order).toEqual(['p1', 'p2', 'p3'])
  })

  it('cleans up tail after completion (no lingering key)', async () => {
    const q = new TxSigningQueueService()
    const wallet = '0xdead'
    const chainId = 8453

    await q.enqueue(wallet, chainId, async () => sleep(5))
    await q.enqueue(wallet, chainId, async () => sleep(5))
    await sleep(5) // allow finalizers to run

    const tails = (q as any).tails as Map<string, Promise<void>>
    expect(tails).toBeDefined()
    expect(tails.size).toBe(0)

    // New tasks should still execute fine after cleanup
    await expect(q.enqueue(wallet, chainId, async () => 'done')).resolves.toBe('done')
  })
})
