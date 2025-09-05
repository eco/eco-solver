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
})
