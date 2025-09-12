import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'

describe('LmTxGatedKernelAccountClientService', () => {
  function makeUnderlying() {
    const client: any = {
      kernelAccount: { address: '0xWallet' },
      execute: jest.fn(async (calls: Array<{ to: string; data?: string; value?: bigint }>) => ({
        ok: true,
        kind: 'execute',
        calls,
      })),
      sendTransaction: jest.fn(async (args: any) => ({ ok: true, kind: 'send', args })),
      someProp: 'hello',
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

    const wrapper = new LmTxGatedKernelAccountClientService(underlying as any, txQueue as any)
    const chainId = 10
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

    const wrapper = new LmTxGatedKernelAccountClientService(underlying as any, txQueue as any)
    const chainId = 8453
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
    const wrapper = new LmTxGatedKernelAccountClientService(
      underlying as any,
      { enqueue: jest.fn() } as any,
    )
    const proxied = await wrapper.getClient(1)

    expect(proxied.kernelAccount.address).toBe('0xWallet')
    expect(proxied.someProp).toBe('hello')
  })

  it('getAddress is passthrough (not enqueued)', async () => {
    const { service: underlying } = makeUnderlying()
    const enqueue = jest.fn()
    const wrapper = new LmTxGatedKernelAccountClientService(underlying as any, { enqueue } as any)

    const addr = await wrapper.getAddress()
    expect(addr).toBe('0xWallet')
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('intercepts transport.request for eth_sendRawTransaction and enqueues', async () => {
    const { client, service: underlying } = makeUnderlying()
    client.transport = {
      request: jest.fn(async (_payload: any) => ({ kind: 'raw', ok: true })),
    }

    const enqueue = jest.fn(async (_wallet: string, _chainId: number, task: () => Promise<any>) =>
      task(),
    )
    const txQueue = { enqueue }

    const wrapper = new LmTxGatedKernelAccountClientService(underlying as any, txQueue as any)
    const chainId = 10
    const proxied = await wrapper.getClient(chainId)

    const payload = { method: 'eth_sendRawTransaction', params: ['0xabc'] }
    const res = await proxied.transport.request(payload)

    expect(enqueue).toHaveBeenCalledTimes(1)
    const [walletArg, chainArg] = enqueue.mock.calls[0]
    expect(walletArg).toBe('0xWallet')
    expect(chainArg).toBe(chainId)
    expect(client.transport.request).toHaveBeenCalledWith(payload)
    expect(res).toEqual({ kind: 'raw', ok: true })
  })

  it('does not enqueue for transport.request methods other than eth_sendRawTransaction', async () => {
    const { client, service: underlying } = makeUnderlying()
    client.transport = {
      request: jest.fn(async (_payload: any) => ({ kind: 'call', ok: true })),
    }

    const enqueue = jest.fn()
    const wrapper = new LmTxGatedKernelAccountClientService(underlying as any, { enqueue } as any)
    const proxied = await wrapper.getClient(1)

    const payload = { method: 'eth_call', params: [] }
    const res = await proxied.transport.request(payload)

    expect(enqueue).not.toHaveBeenCalled()
    expect(client.transport.request).toHaveBeenCalledWith(payload)
    expect(res).toEqual({ kind: 'call', ok: true })
  })

  it('throws error when client has no wallet address', async () => {
    const { service: underlying } = makeUnderlying()
    const client: any = { kernelAccount: null } // No address
    underlying.getClient = jest.fn(async (_chainId: number) => client)

    const wrapper = new LmTxGatedKernelAccountClientService(underlying as any, {} as any)

    await expect(wrapper.getClient(1)).rejects.toThrow(
      'LmTxGatedKernelAccountClientService: No wallet address found on client',
    )
  })

  it('handles transport.request errors correctly', async () => {
    const { client, service: underlying } = makeUnderlying()
    const testError = new Error('RPC error')
    client.transport = {
      request: jest.fn(async () => {
        throw testError
      }),
    }

    const enqueue = jest.fn(async (_wallet: string, _chainId: number, task: () => Promise<any>) =>
      task(),
    )
    const txQueue = { enqueue }

    const wrapper = new LmTxGatedKernelAccountClientService(underlying as any, txQueue as any)
    const proxied = await wrapper.getClient(10)

    const payload = { method: 'eth_sendRawTransaction', params: ['0xabc'] }
    await expect(proxied.transport.request(payload)).rejects.toThrow('RPC error')
    expect(enqueue).toHaveBeenCalledTimes(1)
  })
})
