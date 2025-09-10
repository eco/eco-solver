import { LmTxGatedWalletClientService } from '@/liquidity-manager/wallet-wrappers/wallet-gated-client.service'

describe('LmTxGatedWalletClientService', () => {
  function makeUnderlying() {
    const client: any = {
      account: { address: '0xWallet' },
      writeContract: jest.fn(async (args: any) => ({ ok: true, kind: 'write', args })),
      sendTransaction: jest.fn(async (args: any) => ({ ok: true, kind: 'send', args })),
      someProp: 42,
    }

    return {
      client,
      service: {
        getClient: jest.fn(async (_chainId: number) => client),
        getPublicClient: jest.fn(async (chainId: number) => ({ chainId })),
        getAccount: jest.fn(async () => ({ address: '0xWallet' })),
      },
    }
  }

  it('intercepts writeContract and enqueues via TxSigningQueueService', async () => {
    const { client, service: underlying } = makeUnderlying()
    const enqueue = jest.fn(async (_wallet: string, _chainId: number, task: () => Promise<any>) =>
      task(),
    )
    const txQueue = { enqueue }

    const wrapper = new LmTxGatedWalletClientService(underlying as any, txQueue as any)
    const chainId = 8453
    const proxied = await wrapper.getClient(chainId)

    const args = { to: '0xabc', data: '0xdead' }
    const res = await proxied.writeContract(args)

    expect(enqueue).toHaveBeenCalledTimes(1)
    const [walletArg, chainArg] = enqueue.mock.calls[0]
    expect(walletArg).toBe('0xWallet')
    expect(chainArg).toBe(chainId)

    expect(client.writeContract).toHaveBeenCalledTimes(1)
    expect(client.writeContract).toHaveBeenCalledWith(args)
    expect(res).toEqual({ ok: true, kind: 'write', args })
  })

  it('intercepts sendTransaction and enqueues via TxSigningQueueService', async () => {
    const { client, service: underlying } = makeUnderlying()
    const enqueue = jest.fn(async (_wallet: string, _chainId: number, task: () => Promise<any>) =>
      task(),
    )
    const txQueue = { enqueue }

    const wrapper = new LmTxGatedWalletClientService(underlying as any, txQueue as any)
    const chainId = 10
    const proxied = await wrapper.getClient(chainId)

    const args = { value: 123n, to: '0xdef' }
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
    const txQueue = { enqueue: jest.fn() }
    const wrapper = new LmTxGatedWalletClientService(underlying as any, txQueue as any)
    const proxied = await wrapper.getClient(1)

    expect(proxied.someProp).toBe(42)
  })

  it('getPublicClient and getAccount are passthrough (not enqueued)', async () => {
    const { service: underlying } = makeUnderlying()
    const enqueue = jest.fn()
    const txQueue = { enqueue }
    const wrapper = new LmTxGatedWalletClientService(underlying as any, txQueue as any)

    const pc = await wrapper.getPublicClient(8453)
    const acct = await wrapper.getAccount()

    expect(pc).toEqual({ chainId: 8453 })
    expect(acct).toEqual({ address: '0xWallet' })
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

    const wrapper = new LmTxGatedWalletClientService(underlying as any, txQueue as any)
    const chainId = 1
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
    const txQueue = { enqueue }

    const wrapper = new LmTxGatedWalletClientService(underlying as any, txQueue as any)
    const proxied = await wrapper.getClient(1)

    const payload = { method: 'eth_call', params: [] }
    const res = await proxied.transport.request(payload)

    expect(enqueue).not.toHaveBeenCalled()
    expect(client.transport.request).toHaveBeenCalledWith(payload)
    expect(res).toEqual({ kind: 'call', ok: true })
  })

  it('throws error when client has no wallet address', async () => {
    const { service: underlying } = makeUnderlying()
    const client: any = { account: null } // No address
    underlying.getClient = jest.fn(async (_chainId: number) => client)

    const wrapper = new LmTxGatedWalletClientService(underlying as any, {} as any)

    await expect(wrapper.getClient(1)).rejects.toThrow(
      'LmTxGatedWalletClientService: No wallet address found on client',
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

    const wrapper = new LmTxGatedWalletClientService(underlying as any, txQueue as any)
    const proxied = await wrapper.getClient(1)

    const payload = { method: 'eth_sendRawTransaction', params: ['0xabc'] }
    await expect(proxied.transport.request(payload)).rejects.toThrow('RPC error')
    expect(enqueue).toHaveBeenCalledTimes(1)
  })

  it('handles undefined transport gracefully', async () => {
    const { client, service: underlying } = makeUnderlying()
    client.transport = undefined

    const wrapper = new LmTxGatedWalletClientService(underlying as any, {} as any)
    const proxied = await wrapper.getClient(1)

    expect(proxied.transport).toBeUndefined()
  })

  it('preserves other transport properties', async () => {
    const { client, service: underlying } = makeUnderlying()
    client.transport = {
      request: jest.fn(),
      url: 'http://localhost:8545',
      type: 'http',
    }

    const wrapper = new LmTxGatedWalletClientService(underlying as any, {} as any)
    const proxied = await wrapper.getClient(1)

    expect(proxied.transport.url).toBe('http://localhost:8545')
    expect(proxied.transport.type).toBe('http')
  })

  it('handles concurrent eth_sendRawTransaction by enqueuing both', async () => {
    const { client, service: underlying } = makeUnderlying()

    client.transport = {
      request: jest.fn(async (payload: any) => ({ txHash: payload.params[0] })),
    }

    const enqueuedCalls: Array<{ wallet: string; chainId: number }> = []
    const enqueue = jest.fn(async (wallet: string, chainId: number, task: () => Promise<any>) => {
      enqueuedCalls.push({ wallet, chainId })
      return task()
    })
    const txQueue = { enqueue }

    const wrapper = new LmTxGatedWalletClientService(underlying as any, txQueue as any)
    const proxied = await wrapper.getClient(1)

    const [res1, res2] = await Promise.all([
      proxied.transport.request({ method: 'eth_sendRawTransaction', params: ['0xaaa'] }),
      proxied.transport.request({ method: 'eth_sendRawTransaction', params: ['0xbbb'] }),
    ])

    expect(res1).toEqual({ txHash: '0xaaa' })
    expect(res2).toEqual({ txHash: '0xbbb' })
    expect(enqueuedCalls).toEqual([
      { wallet: '0xWallet', chainId: 1 },
      { wallet: '0xWallet', chainId: 1 },
    ])
    expect(enqueue).toHaveBeenCalledTimes(2)
  })
})
