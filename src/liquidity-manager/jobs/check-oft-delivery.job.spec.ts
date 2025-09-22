import { CheckOFTDeliveryJobManager } from '@/liquidity-manager/jobs/check-oft-delivery.job'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { UnrecoverableError } from 'bullmq'

describe('CheckOFTDeliveryJobManager', () => {
  it('start() enqueues with expected options', async () => {
    const add = jest.fn()
    const queue: any = { add }
    const data: any = {
      groupID: 'g',
      rebalanceJobID: 'r',
      sourceChainId: 1,
      destinationChainId: 42161,
      walletAddress: '0x' + 'b'.repeat(40),
      amountLD: '1000000',
      txHash: '0x' + 'a'.repeat(64),
    }

    await CheckOFTDeliveryJobManager.start(queue, data, 123)

    expect(add).toHaveBeenCalledWith(
      LiquidityManagerJobName.CHECK_OFT_DELIVERY,
      data,
      expect.objectContaining({ removeOnFail: false, delay: 123, attempts: 20 }),
    )
  })

  it('process(): throws UnrecoverableError when destination chain not configured', async () => {
    const mgr = new CheckOFTDeliveryJobManager()
    ;(mgr as any).ecoConfigService = { getUSDT0: () => ({ chains: [] }) }
    // stub delay to avoid throwing DelayedError
    ;(mgr as any).delay = jest.fn(async () => {})

    const processor: any = {
      logger: { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }
    const job: any = {
      name: LiquidityManagerJobName.CHECK_OFT_DELIVERY,
      data: {
        destinationChainId: 999,
      },
      moveToDelayed: jest.fn(),
      token: 't',
    }
    await expect(mgr.process(job, processor)).rejects.toBeInstanceOf(UnrecoverableError)
  })

  it('process(): returns complete when LayerZero Scan reports delivered (top-level or destination)', async () => {
    const mgr = new CheckOFTDeliveryJobManager()
    ;(mgr as any).ecoConfigService = {
      getUSDT0: () => ({
        scanApiBaseUrl: 'https://scan.layerzero-api.com/v1',
        chains: [
          {
            chainId: 1,
            eid: 30101,
            type: 'adapter',
            contract: '0x' + '1'.repeat(40),
            decimals: 6,
            underlyingToken: '0x' + '2'.repeat(40),
          },
          {
            chainId: 42161,
            eid: 30110,
            type: 'oft',
            contract: '0x' + '3'.repeat(40),
            decimals: 6,
            token: '0x' + '4'.repeat(40),
          },
        ],
      }),
    }
    ;(mgr as any).delay = jest.fn(async () => {})

    const processor: any = {
      logger: { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }

    const job: any = {
      name: LiquidityManagerJobName.CHECK_OFT_DELIVERY,
      data: {
        id: 'id-1',
        sourceChainId: 42161,
        destinationChainId: 1,
        txHash: '0x' + 'a'.repeat(64),
        walletAddress: '0x' + '5'.repeat(40),
        amountLD: '100',
      },
      moveToDelayed: jest.fn(),
      token: 't',
    }

    const originalFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            pathway: { srcEid: 30110, dstEid: 30101 },
            destination: {
              status: 'SUCCEEDED',
              tx: { txHash: '0x' + 'c'.repeat(64) },
            },
            status: { name: 'DELIVERED' },
          },
        ],
      }),
    })

    try {
      const res = await mgr.process(job, processor)
      expect(res).toEqual({ status: 'complete' })
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('process(): throws UnrecoverableError when LayerZero Scan reports FAILED', async () => {
    const mgr = new CheckOFTDeliveryJobManager()
    ;(mgr as any).ecoConfigService = {
      getUSDT0: () => ({
        scanApiBaseUrl: 'https://scan.layerzero-api.com/v1',
        chains: [
          {
            chainId: 1,
            eid: 30101,
            type: 'adapter',
            contract: '0x' + '1'.repeat(40),
            decimals: 6,
            underlyingToken: '0x' + '2'.repeat(40),
          },
          {
            chainId: 42161,
            eid: 30110,
            type: 'oft',
            contract: '0x' + '3'.repeat(40),
            decimals: 6,
            token: '0x' + '4'.repeat(40),
          },
        ],
      }),
    }
    ;(mgr as any).delay = jest.fn(async () => {})

    const processor: any = {
      logger: { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }

    const job: any = {
      name: LiquidityManagerJobName.CHECK_OFT_DELIVERY,
      data: {
        id: 'id-2',
        sourceChainId: 42161,
        destinationChainId: 1,
        txHash: '0x' + 'b'.repeat(64),
        walletAddress: '0x' + '5'.repeat(40),
        amountLD: '100',
      },
      moveToDelayed: jest.fn(),
      token: 't',
    }

    const originalFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            pathway: { srcEid: 30110, dstEid: 30101 },
            destination: { status: 'FAILED', tx: { txHash: '0x' + 'd'.repeat(64) } },
            status: { name: 'FAILED' },
          },
        ],
      }),
    })

    try {
      await expect(mgr.process(job, processor)).rejects.toBeInstanceOf(UnrecoverableError)
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })

  it('process(): returns pending when API non-OK', async () => {
    const mgr = new CheckOFTDeliveryJobManager()
    ;(mgr as any).ecoConfigService = {
      getUSDT0: () => ({
        scanApiBaseUrl: 'https://scan.layerzero-api.com/v1',
        chains: [
          {
            chainId: 1,
            eid: 30101,
            type: 'adapter',
            contract: '0x' + '1'.repeat(40),
            decimals: 6,
            underlyingToken: '0x' + '2'.repeat(40),
          },
          {
            chainId: 42161,
            eid: 30110,
            type: 'oft',
            contract: '0x' + '3'.repeat(40),
            decimals: 6,
            token: '0x' + '4'.repeat(40),
          },
        ],
      }),
    }
    ;(mgr as any).delay = jest.fn(async () => {})

    const processor: any = {
      logger: { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }

    const job: any = {
      name: LiquidityManagerJobName.CHECK_OFT_DELIVERY,
      data: {
        id: 'id-3',
        sourceChainId: 42161,
        destinationChainId: 1,
        txHash: '0x' + 'e'.repeat(64),
        walletAddress: '0x' + '5'.repeat(40),
        amountLD: '100',
      },
      moveToDelayed: jest.fn(),
      token: 't',
    }

    const originalFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500, statusText: 'err' })

    try {
      const res = await mgr.process(job, processor)
      expect(res).toEqual({ status: 'pending' })
      expect((mgr as any).delay).toHaveBeenCalled()
    } finally {
      ;(globalThis as any).fetch = originalFetch
    }
  })
})
