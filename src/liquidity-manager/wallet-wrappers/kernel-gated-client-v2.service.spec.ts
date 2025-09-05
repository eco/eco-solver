import { LmTxGatedKernelAccountClientV2Service } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client-v2.service'

describe('LmTxGatedKernelAccountClientV2Service', () => {
  function makeUnderlying() {
    const client: any = {
      account: { address: '0xWallet' },
      execute: jest.fn(async (calls: Array<{ to: string; data?: string; value?: bigint }>) => ({
        ok: true,
        kind: 'execute',
        calls,
      })),
      sendTransaction: jest.fn(async (args: any) => ({ ok: true, kind: 'send', args })),
      someProp: 'v2-hello',
    }

    return {
      client,
      service: {
        getClient: jest.fn(async (_chainId: number) => client),
        getAddress: jest.fn(async () => '0xWallet'),
      },
    }
  }

  it('intercepts execute and enqueues via TxSigningQueueService', async () => {
    const { client, service: underlying } = makeUnderlying()
    const enqueue = jest.fn(async (_wallet: string, _chainId: number, task: () => Promise<any>) =>
      task(),
    )
    const txQueue = { enqueue }

    const wrapper = new LmTxGatedKernelAccountClientV2Service(underlying as any, txQueue as any)
    const chainId = 8453
    const proxied = await wrapper.getClient(chainId)

    const calls = [
      { to: '0xabc', data: '0xdead' },
      { to: '0xdef', value: 123n },
    ]
    const res = await proxied.execute(calls)

    expect(enqueue).toHaveBeenCalledTimes(1)
    const [walletArg, chainArg] = enqueue.mock.calls[0]
    expect(walletArg).toBe('0xWallet')
    expect(chainArg).toBe(chainId)

    expect(client.execute).toHaveBeenCalledTimes(1)
    expect(client.execute).toHaveBeenCalledWith(calls)
    expect(res).toEqual({ ok: true, kind: 'execute', calls })
  })

  it('intercepts sendTransaction and enqueues via TxSigningQueueService', async () => {
    const { client, service: underlying } = makeUnderlying()
    const enqueue = jest.fn(async (_wallet: string, _chainId: number, task: () => Promise<any>) =>
      task(),
    )
    const txQueue = { enqueue }

    const wrapper = new LmTxGatedKernelAccountClientV2Service(underlying as any, txQueue as any)
    const chainId = 10
    const proxied = await wrapper.getClient(chainId)

    const args = { to: '0xaaa', data: '0xbeef' }
    const res = await proxied.sendTransaction(args)

    expect(enqueue).toHaveBeenCalledTimes(1)
    const [walletArg, chainArg] = enqueue.mock.calls[0]
    expect(walletArg).toBe('0xWallet')
    expect(chainArg).toBe(chainId)

    expect(client.sendTransaction).toHaveBeenCalledTimes(1)
    expect(client.sendTransaction).toHaveBeenCalledWith(args)
    expect(res).toEqual({ ok: true, kind: 'send', args })
  })

  it('forwards non-intercepted properties via Proxy (Reflect.get)', async () => {
    const { client, service: underlying } = makeUnderlying()
    const wrapper = new LmTxGatedKernelAccountClientV2Service(
      underlying as any,
      { enqueue: jest.fn() } as any,
    )
    const proxied = await wrapper.getClient(1)

    expect(proxied.account.address).toBe('0xWallet')
    expect(proxied.someProp).toBe('v2-hello')
  })

  it('getAddress is passthrough (not enqueued)', async () => {
    const { service: underlying } = makeUnderlying()
    const enqueue = jest.fn()
    const wrapper = new LmTxGatedKernelAccountClientV2Service(underlying as any, { enqueue } as any)

    const addr = await wrapper.getAddress()
    expect(addr).toBe('0xWallet')
    expect(enqueue).not.toHaveBeenCalled()
  })
})
