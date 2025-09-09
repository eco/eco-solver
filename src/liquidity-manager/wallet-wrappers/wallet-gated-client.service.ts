import { Injectable } from '@nestjs/common'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { TxSigningQueueService } from '@/liquidity-manager/wallet-wrappers/tx-signing-queue.service'

/**
 * LmTxGatedWalletClientService
 *
 * Wraps the default WalletClient so that only tx-signing/broadcasting methods are serialized per
 * (wallet, chainId). Non-intercepted properties and methods are forwarded using Reflect.get.
 *
 * Intercepted methods
 * - writeContract(args)
 * - sendTransaction(args)
 *
 * Non-intercepted members
 * - account, chain, transport, and any other properties/methods behave like the underlying client.
 */
@Injectable()
export class LmTxGatedWalletClientService {
  constructor(
    private readonly underlying: WalletClientDefaultSignerService,
    private readonly txQueue: TxSigningQueueService,
  ) {}

  /**
   * Returns a Proxy-wrapped wallet client for the provided chain. Signing/broadcast calls are
   * serialized for the wallet on that chain.
   */
  async getClient(chainId: number) {
    const client = await this.underlying.getClient(chainId)
    const account = (client as any).account
    const wallet: string = account?.address
    if (!wallet) {
      throw new Error('LmTxGatedWalletClientService: No wallet address found on client')
    }

    return new Proxy(client as any, {
      get: (target, prop, receiver) => {
        if (prop === 'writeContract') {
          return async (args: any) =>
            this.txQueue.enqueue(wallet, chainId, () => target.writeContract(args))
        }
        if (prop === 'sendTransaction') {
          return async (args: any) =>
            this.txQueue.enqueue(wallet, chainId, () => target.sendTransaction(args))
        }
        if (prop === 'transport') {
          const transport = Reflect.get(target, prop, receiver)
          if (!transport) return transport

          return new Proxy(transport, {
            get: (tgt, tprop, treceiver) => {
              if (tprop === 'request') {
                const requestFn = Reflect.get(tgt, tprop, treceiver)
                return async (...args: any[]) => {
                  const payload = args[0]
                  if (payload && payload.method === 'eth_sendRawTransaction') {
                    return this.txQueue.enqueue(wallet, chainId, async () =>
                      Reflect.apply(requestFn, tgt, args),
                    )
                  }
                  return Reflect.apply(requestFn, tgt, args)
                }
              }
              return Reflect.get(tgt, tprop, treceiver)
            },
          })
        }
        return Reflect.get(target, prop, receiver)
      },
    })
  }

  /**
   * Passthroughs for non-gated access used by callers that only need read-only clients or metadata.
   */
  async getPublicClient(chainId: number) {
    return this.underlying.getPublicClient(chainId)
  }

  async getAccount() {
    return this.underlying.getAccount()
  }
}
