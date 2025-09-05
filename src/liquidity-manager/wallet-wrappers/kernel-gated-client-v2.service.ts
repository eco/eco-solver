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
    const wallet: string = client.account?.address as string

    return new Proxy(client as any, {
      get: (target, prop, receiver) => {
        if (prop === 'execute') {
          return async (calls: Array<{ to: string; data?: string; value?: bigint }>) =>
            this.txQueue.enqueue(wallet, chainId, () => target.execute(calls))
        }
        if (prop === 'sendTransaction') {
          return async (args: any) =>
            this.txQueue.enqueue(wallet, chainId, () => target.sendTransaction(args))
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
