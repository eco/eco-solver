import { Injectable } from '@nestjs/common'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { TxSigningQueueService } from '@/liquidity-manager/wallet-wrappers/tx-signing-queue.service'

/**
 * LmTxGatedKernelAccountClientV2Service
 *
 * Wraps the underlying Kernel account client so that only the critical methods that sign/broadcast
 * transactions are serialized per (wallet, chainId). All other methods/properties are transparently
 * forwarded through the Proxy using Reflect.get, preserving behavior and "this" binding.
 *
 * Intercepted methods
 * - execute(calls)
 * - sendTransaction(args)
 *
 * Non-intercepted members
 * - Accessed via Reflect.get and behave exactly like the underlying client (e.g., account, chain, etc.).
 */
@Injectable()
export class LmTxGatedKernelAccountClientV2Service {
  constructor(
    private readonly underlying: KernelAccountClientV2Service,
    private readonly txQueue: TxSigningQueueService,
  ) {}

  /**
   * Returns a Proxy-wrapped client for the provided chain, serializing tx signing/broadcast
   * for the wallet on that chain via TxSigningQueueService.
   */
  async getClient(chainId: number) {
    const client = await this.underlying.getClient(chainId)
    const wallet = client.account?.address
    if (!wallet) {
      throw new Error('LmTxGatedKernelAccountClientV2Service: No wallet address found on client')
    }

    return new Proxy(client as any, {
      get: (target, prop, receiver) => {
        if (prop === 'execute') {
          return async (calls: Array<{ to: string; data?: string; value?: bigint }>) =>
            this.txQueue.enqueue(wallet, chainId, () => {
              const exec = (target as any).execute || (target as any).sendTransactions
              if (typeof exec !== 'function') {
                throw new TypeError('Kernel client: execute/sendTransactions is not a function')
              }
              return exec.call(target, calls)
            })
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
   * Convenience passthrough to resolve the Kernel wallet address without gating.
   */
  async getAddress() {
    return this.underlying.getAddress()
  }
}
